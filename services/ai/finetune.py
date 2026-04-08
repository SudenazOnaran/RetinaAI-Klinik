import os

import torch
import torch.nn as nn
from PIL import Image
from prisma import Prisma
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms

# Settings
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
BATCH_SIZE = 8
EPOCHS = 3
LR = 1e-4
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "model.pth")
FINETUNED_PATH = os.path.join(BASE_DIR, "models", "model_finetuned.pth")

prisma = Prisma()
prisma.connect()


class DRDataset(Dataset):
    def __init__(self, records, transform=None):
        self.records = records
        self.transform = transform

    def __len__(self):
        return len(self.records)

    def __getitem__(self, idx):
        record = self.records[idx]
        img = Image.open(record["originalImage"]).convert("RGB")
        label_map = {
            "No_DR": 0,
            "Mild": 1,
            "Moderate": 2,
            "Severe": 3,
            "Proliferative_DR": 4,
        }
        label = label_map.get(record["drFeedback"], 0)
        if self.transform:
            img = self.transform(img)
        return img, label


transform = transforms.Compose(
    [
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ]
)

records = prisma.analysis.find_many(where={"drFeedback": {"not": None}})
if len(records) == 0:
    print("Fine-tuning icin veri yok.")
    raise SystemExit(0)

dataset = DRDataset(records, transform=transform)
loader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)

model = models.densenet121(weights=None)
model.classifier = nn.Sequential(
    nn.Dropout(0.3),
    nn.Linear(model.classifier.in_features, 5),
)
model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
model = model.to(DEVICE)
model.train()

criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=LR)

for epoch in range(EPOCHS):
    total_loss = 0.0
    for imgs, labels in loader:
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        optimizer.zero_grad()
        outputs = model(imgs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()
    print(f"Epoch {epoch + 1}/{EPOCHS} - Loss: {total_loss / len(loader):.4f}")

torch.save(model.state_dict(), FINETUNED_PATH)
print(f"Fine-tuned model kaydedildi: {FINETUNED_PATH}")
prisma.disconnect()
