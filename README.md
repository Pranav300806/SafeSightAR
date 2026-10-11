#  SafeSight AR & SmartSpace AR System
> **A Context-Aware Augmented Reality System for Detecting Everyday Risks and Visualizing Spatial Environments**

[![Unity Engine](https://img.shields.io/badge/Unity-6000.3.23f1-black.svg?logo=unity)](https://unity3d.com/)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20ARCore-green.svg?logo=android)](https://developers.google.com/ar)
[![Scripting Backend](https://img.shields.io/badge/Backend-IL2CPP%20%2F%20Mono-blue.svg)]()
[![Architecture](https://img.shields.io/badge/Target-ARM64-orange.svg)]()
[![Zero Localhost](https://img.shields.io/badge/Network-100%25%20On--Device%20(Zero--Localhost)-brightgreen.svg)]()

---

##  Overview

**SafeSight AR** bridges the gap between passive object identification and proactive situational safety. Standard AR tools identify *what* an object is, but fail to evaluate *whether the situation is hazardous*. SafeSight AR analyzes spatial and relational dynamics between objects to detect everyday hazards (spills, edge drops, trip points) before human error leads to accidents.

Integrated into this repository is **SmartSpace AR**, an interior furniture layout and placement module featuring dynamic furniture swapping and an **In-Editor "Anti-Gravity" Simulation Rig** for zero-hardware testing.

---

## Core System Capabilities

### 1. Relational Risk Intelligence (SafeSight)
Unlike traditional computer vision that flags individual objects in isolation, the Risk Engine evaluates pairwise spatial proximity:
* ** Spill Risk:** Liquid container placed within critical proximity ($\Delta d \le 0.35\text{ m}$) of electronic equipment (laptop, keyboard).
* ** Fall / Cut Risk:** Sharp tools (knives) placed near perimeter edges ($\le 0.12\text{ m}$) of tables or desks.
* ** Trip Hazard:** Protruding open drawers ($\gt 0.40\text{ m}$) or cables crossing floor walkway vectors.

### 2. Dynamic Furniture & Replacement System (SmartSpace)
* **Mobile AR Placement:** Real-world surface plane tracking and reticle-based tap-to-place workflows powered by AR Foundation.
* **Dynamic Furniture Swapping:** Replace existing placed items directly from the catalog while preserving world coordinates, orientation, and scaling baselines.
* **Responsive Control HUD:** Contextual action bar providing quick controls for Rotate (45°), Scale, Replace, and Delete.

### 3. In-Editor "Anti-Gravity" Simulation Rig
* **Hardware-Free Testing:** Run tests directly in the Unity Game view without deploying to an Android device.
* **Zero-G Physics Dynamics:** Objects float with spring-damped levitation physics (`Rigidbody.useGravity = false`) to test spatial clearance without dropping through ground planes.
* **Desktop Controls:** Left-click drag to reposition; mouse scroll-wheel to push/pull depth along the camera ray.

---

##  Architecture & Project Structure

```text
Assets/
├── Scenes/
│   ├── MainSimulation.unity          # Desktop Anti-Gravity risk simulation scene
│   ├── MobileAR_Furniture.unity      # ARCore mobile furniture placement & replacement scene
│   └── Furniture_Test.unity          # UI & selection isolation test sandbox
├── Scripts/
│   ├── AR/
│   │   ├── ARManager.cs              # Session lifecycle & plane management
│   │   ├── PlacementManager.cs       # Surface raycast instantiation
│   │   └── InteractionManager.cs     # Gesture-based spatial interaction
│   ├── RiskEngine/
│   │   ├── HazardTypes.cs            # ActiveHazard and DetectedEntity structs
│   │   └── RiskEvaluator.cs          # Relational distance evaluation & debounce
│   ├── Furniture/
│   │   ├── FurnitureItem.cs          # ScriptableObject catalog metadata
│   │   ├── FurnitureManager.cs       # Item registry & in-place replacement pipeline
│   │   ├── FurnitureUI.cs            # Selection drawer & action bar bindings
│   │   └── ObjectControls.cs         # Transform manipulation controls
│   ├── Simulation/
│   │   ├── AntiGravityInteractable.cs # Zero-G hover, spring damping & mouse drag
│   │   └── SceneSimulatorRunner.cs   # Live entity polling loop
│   └── UI/
│       └── ARHazardOverlayUI.cs      # Screen-space and world-space warning indicators
├── Prefabs/
│   ├── Furniture/                    # Sofa, Chair, Table, Bed, Desk, Drawer, Lamp
│   └── Props/                        # Hazard simulation test objects (Laptop, Bottle, Knife)
└── UI/
    ├── Panels/
    └── Buttons/
