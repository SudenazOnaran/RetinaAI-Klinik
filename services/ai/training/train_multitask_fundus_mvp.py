"""
Cok gorevli MVP: DR evresi (5 sinif) + fundus bulgular (9 BCE) + DME (1 BCE).
samples.jsonl: export-training-dataset-entries.js (full_analysis_snapshot_v1) ile uyumlu.
Satirda `fundus_findings` yoksa (AI snapshot kaydedilmemisse) bu script o ornegi atlar.

Ornek:
  python training/train_multitask_fundus_mvp.py ^
    --dataset ../../apps/web/exports/training-dataset-XXX/samples.jsonl ^
    --images-root ../../apps/web/exports/training-dataset-XXX ^
    --epochs 8 --batch-size 8 ^
    --out training_out/multitask_mvp.pt
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from collections import defaultdict
from pathlib import Path

_TRAIN_DIR = Path(__file__).resolve().parent
if str(_TRAIN_DIR) not in sys.path:
    sys.path.insert(0, str(_TRAIN_DIR))

import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms

from fundus_constants import DR_GRADE_LABELS_TR, FUNDUS_FINDING_KEYS


def load_samples(jsonl_path: Path) -> list[dict]:
    rows = []
    with open(jsonl_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def patient_key(row: dict) -> str:
    if row.get("patient_bucket"):
        return str(row["patient_bucket"])
    if row.get("patient_id_anonymized"):
        return str(row["patient_id_anonymized"])
    return str(row.get("patient_id") or row.get("analysis_id") or row["sample_id"])


def split_by_patient(
    rows: list[dict], val_ratio: float, seed: int
) -> tuple[list[dict], list[dict]]:
    rng = random.Random(seed)
    by_p = defaultdict(list)
    for r in rows:
        by_p[patient_key(r)].append(r)
    pids = list(by_p.keys())
    rng.shuffle(pids)
    n_val = max(1, int(len(pids) * val_ratio)) if len(pids) > 1 else 0
    val_set = set(pids[:n_val])
    train_rows, val_rows = [], []
    for pid, rs in by_p.items():
        (val_rows if pid in val_set else train_rows).extend(rs)
    return train_rows, val_rows


def dr_label(row: dict) -> int | None:
    for key in ("recommended_training_grade", "pseudo_dr_grade_int"):
        v = row.get(key)
        if v is None:
            continue
        try:
            i = int(v)
        except (TypeError, ValueError):
            continue
        if 0 <= i <= 4:
            return i
    hl = row.get("human_label") or {}
    v = hl.get("gold_dr_grade_int")
    if v is None:
        return None
    try:
        i = int(v)
    except (TypeError, ValueError):
        return None
    if 0 <= i <= 4:
        return i
    return None


def fundus_targets(row: dict) -> torch.Tensor | None:
    """Export'ta `fundus_findings` yoksa (yalnizca DR kaydi) cok gorevli ornek atlanir."""
    raw = row.get("fundus_findings")
    if raw is None:
        return None
    if not isinstance(raw, dict):
        return None
    t = torch.zeros(len(FUNDUS_FINDING_KEYS), dtype=torch.float32)
    for i, k in enumerate(FUNDUS_FINDING_KEYS):
        v = raw.get(k)
        if v is True:
            t[i] = 1.0
        elif v is False:
            t[i] = 0.0
    return t


def dme_target(row: dict) -> float:
    if row.get("dme_suspected") is True:
        return 1.0
    if row.get("dme_suspected") is False:
        return 0.0
    c = row.get("dme_confidence")
    if isinstance(c, (int, float)) and c >= 0.5:
        return 1.0
    return 0.0


class MultitaskJsonlDataset(Dataset):
    def __init__(
        self,
        rows: list[dict],
        images_root: Path,
        transform,
    ):
        self.items: list[tuple[Path, int, torch.Tensor, float]] = []
        for row in rows:
            rel = row.get("image_relative_path")
            if not rel:
                continue
            lab = dr_label(row)
            if lab is None:
                continue
            fu = fundus_targets(row)
            if fu is None:
                continue
            p = images_root / rel
            if not p.is_file():
                continue
            self.items.append((p, lab, fu, dme_target(row)))
        self.transform = transform

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        path, y_dr, y_fundus, y_dme = self.items[idx]
        img = Image.open(path).convert("RGB")
        x = self.transform(img)
        return x, y_dr, y_fundus, torch.tensor(y_dme, dtype=torch.float32)


class MultiTaskFundusModel(nn.Module):
    def __init__(self):
        super().__init__()
        m = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
        m.fc = nn.Identity()
        self.backbone = m
        d = 512
        self.head_dr = nn.Linear(d, 5)
        self.head_fundus = nn.Linear(d, len(FUNDUS_FINDING_KEYS))
        self.head_dme = nn.Linear(d, 1)

    def forward(self, x):
        feat = self.backbone(x)
        return self.head_dr(feat), self.head_fundus(feat), self.head_dme(feat)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", type=Path, required=True)
    ap.add_argument("--images-root", type=Path, required=True)
    ap.add_argument("--val-ratio", type=float, default=0.2)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--epochs", type=int, default=8)
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--out", type=Path, default=Path("training_out/multitask_mvp.pt"))
    args = ap.parse_args()

    all_rows = load_samples(args.dataset)
    train_rows, val_rows = split_by_patient(all_rows, args.val_ratio, args.seed)

    train_tf = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.RandomHorizontalFlip(),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
            ),
        ]
    )
    val_tf = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
            ),
        ]
    )

    ds_tr = MultitaskJsonlDataset(train_rows, args.images_root, train_tf)
    ds_va = MultitaskJsonlDataset(val_rows, args.images_root, val_tf)

    if len(ds_tr) == 0:
        raise SystemExit(
            "Egitim ornegi yok. JSONL'de `fundus_findings` (export, Analysis.aiInferenceJson) "
            "olan kayit gerekir; yalnizca DR icin train_dr_classifier_mvp.py kullanin."
        )

    def collate(batch):
        xs, drs, fs, dmes = zip(*batch)
        return (
            torch.stack(xs),
            torch.tensor(drs, dtype=torch.long),
            torch.stack(fs),
            torch.stack(dmes).unsqueeze(1),
        )

    dl_tr = DataLoader(
        ds_tr,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,
        collate_fn=collate,
    )
    dl_va = DataLoader(
        ds_va,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
        collate_fn=collate,
    )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = MultiTaskFundusModel().to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr)
    ce = nn.CrossEntropyLoss()
    bce = nn.BCEWithLogitsLoss()

    args.out.parent.mkdir(parents=True, exist_ok=True)

    for epoch in range(args.epochs):
        model.train()
        tr_loss = 0.0
        n = 0
        for x, y_dr, y_f, y_dme in dl_tr:
            x = x.to(device)
            y_dr = y_dr.to(device)
            y_f = y_f.to(device)
            y_dme = y_dme.to(device)
            opt.zero_grad()
            dr_l, fu_l, dm_l = model(x)
            loss = (
                ce(dr_l, y_dr)
                + bce(fu_l, y_f)
                + bce(dm_l, y_dme)
            )
            loss.backward()
            opt.step()
            tr_loss += loss.item() * x.size(0)
            n += x.size(0)
        tr_loss /= max(n, 1)

        model.eval()
        correct = 0
        tot = 0
        with torch.no_grad():
            for x, y_dr, _, _ in dl_va:
                x = x.to(device)
                y_dr = y_dr.to(device)
                dr_l, _, _ = model(x)
                pred = dr_l.argmax(dim=1)
                correct += (pred == y_dr).sum().item()
                tot += y_dr.size(0)
        va_acc = correct / tot if tot else 0.0
        print(
            f"epoch {epoch + 1}/{args.epochs} train_loss={tr_loss:.4f} dr_val_acc={va_acc:.4f}"
        )

    torch.save(
        {
            "state_dict": model.state_dict(),
            "arch": "resnet18_multitask_fundus_mvp",
            "fundus_keys": list(FUNDUS_FINDING_KEYS),
            "dr_grade_labels_tr": DR_GRADE_LABELS_TR,
        },
        args.out,
    )
    print("saved", args.out)


if __name__ == "__main__":
    main()
