"""
DR siniflandirma MVP: export edilen samples.jsonl + images/ klasorunden ogrenir.
Hasta bazli train/val ayrimi (patient_id veya patient_id_anonymized).

Ornek:
  cd retina_ai/services/ai
  python training/train_dr_classifier_mvp.py ^
    --dataset ../../apps/web/exports/dataset-XXXX/samples.jsonl ^
    --images-root ../../apps/web/exports/dataset-XXXX ^
    --epochs 5 --batch-size 8

Etiket: varsayilan `recommended_training_grade`; yoksa --label-field ile.
"""
from __future__ import annotations

import argparse
import json
import random
from collections import defaultdict
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms


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
    if row.get("patient_id_anonymized"):
        return str(row["patient_id_anonymized"])
    return str(row.get("patient_id") or row.get("analysis_id") or row["sample_id"])


def pick_label(row: dict, label_field: str) -> int | None:
    if label_field == "recommended_training_grade":
        v = row.get("recommended_training_grade")
    elif label_field == "pseudo_dr_grade_int":
        v = row.get("pseudo_dr_grade_int")
    elif label_field == "human_gold":
        hl = row.get("human_label") or {}
        v = hl.get("gold_dr_grade_int")
    else:
        v = row.get(label_field)
    if v is None:
        return None
    try:
        i = int(v)
    except (TypeError, ValueError):
        return None
    if 0 <= i <= 4:
        return i
    return None


class FundusJsonlDataset(Dataset):
    def __init__(
        self,
        rows: list[dict],
        images_root: Path,
        label_field: str,
        train_transform,
    ):
        self.items: list[tuple[Path, int]] = []
        for row in rows:
            rel = row.get("image_relative_path")
            if not rel:
                continue
            lab = pick_label(row, label_field)
            if lab is None:
                continue
            p = images_root / rel
            if not p.is_file():
                continue
            self.items.append((p, lab))
        self.train_transform = train_transform

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        path, y = self.items[idx]
        img = Image.open(path).convert("RGB")
        x = self.train_transform(img)
        return x, y


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
        if pid in val_set:
            val_rows.extend(rs)
        else:
            train_rows.extend(rs)
    return train_rows, val_rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", type=Path, required=True, help="samples.jsonl")
    ap.add_argument("--images-root", type=Path, required=True, help="export kok klasoru")
    ap.add_argument(
        "--label-field",
        default="recommended_training_grade",
        choices=(
            "recommended_training_grade",
            "pseudo_dr_grade_int",
            "human_gold",
        ),
    )
    ap.add_argument("--val-ratio", type=float, default=0.2)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--epochs", type=int, default=5)
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--out", type=Path, default=Path("training_out/dr_mvp.pt"))
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

    ds_tr = FundusJsonlDataset(
        train_rows, args.images_root, args.label_field, train_tf
    )
    ds_va = FundusJsonlDataset(val_rows, args.images_root, args.label_field, val_tf)

    if len(ds_tr) == 0:
        raise SystemExit("Egitim ornegi yok: jsonl, goruntu yolu veya etiket kontrol edin.")

    dl_tr = DataLoader(
        ds_tr, batch_size=args.batch_size, shuffle=True, num_workers=0
    )
    dl_va = DataLoader(ds_va, batch_size=args.batch_size, shuffle=False, num_workers=0)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
    model.fc = nn.Linear(model.fc.in_features, 5)
    model = model.to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr)
    loss_fn = nn.CrossEntropyLoss()

    args.out.parent.mkdir(parents=True, exist_ok=True)

    for epoch in range(args.epochs):
        model.train()
        tr_loss = 0.0
        for x, y in dl_tr:
            x, y = x.to(device), y.to(device)
            opt.zero_grad()
            logits = model(x)
            loss = loss_fn(logits, y)
            loss.backward()
            opt.step()
            tr_loss += loss.item() * x.size(0)
        tr_loss /= len(ds_tr)

        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for x, y in dl_va:
                x, y = x.to(device), y.to(device)
                pred = model(x).argmax(dim=1)
                correct += (pred == y).sum().item()
                total += y.size(0)
        va_acc = correct / total if total else 0.0
        print(f"epoch {epoch + 1}/{args.epochs} train_loss={tr_loss:.4f} val_acc={va_acc:.4f}")

    torch.save(
        {
            "state_dict": model.state_dict(),
            "classes": 5,
            "label_field": args.label_field,
        },
        args.out,
    )
    print("saved", args.out)


if __name__ == "__main__":
    main()
