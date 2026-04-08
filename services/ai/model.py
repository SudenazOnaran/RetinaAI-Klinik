import torch.nn as nn
from torchvision import models

def load_model(num_classes=5):
    model = models.densenet121(weights=None)  
    # pretrained=False yerine weights=None (yeni API)

    model.classifier = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(model.classifier.in_features, num_classes)
    )

    return model
