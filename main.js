// SafeSight AR - Mobile AR Furniture & Zero-G Spatial Simulation Engine
// Client-Only, Zero-Localhost Three.js + AR Foundation Web Simulator

let scene, camera, renderer, controls;
let visionScene, visionCamera, visionRenderer;
let raycaster, mouse;
let floorPlane;
let arReticle;

// Current Mode: 'furniture' or 'antigravity'
let currentMode = 'furniture';
let selectedCatalogType = 'sofa';
let selectedPlacedObject = null;
const placedFurnitureList = [];

// SafeSight Hazard Entities (Zero-G mode)
const antiGravityEntities = {};
const riskDebounceTimers = {};

// Settings
let walkwayClearanceThreshold = 0.50; // 50 cm
let currentRotationDeg = 0;
let isDraggingFurniture = false;
let webcamActive = false;
let webcamVideo = null;
let webcamTexture = null;

// Table Dimensions (for Zero-G Mode)
const tableBounds = {
  center: new THREE.Vector3(0, 0.725, 0.25),
  size: new THREE.Vector3(1.60, 0.05, 0.90),
  halfX: 0.80,
  halfZ: 0.45,
  topY: 0.75
};

window.addEventListener('DOMContentLoaded', init);

function init() {
  const container = document.querySelector('.simulation-viewport');
  const canvas3D = document.getElementById('canvas-3d');

  // 1. Scene & Camera Setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f1d);

  camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 50);
  camera.position.set(0.0, 1.8, 2.5);
  camera.lookAt(0, 0.4, 0);

  renderer = new THREE.WebGLRenderer({ canvas: canvas3D, antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.4, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below floor

  // 2. Secondary AR Vision Feed
  const visionCanvas = document.getElementById('vision-canvas');
  visionScene = scene;
  visionCamera = new THREE.PerspectiveCamera(60, visionCanvas.clientWidth / visionCanvas.clientHeight, 0.05, 20);
  visionCamera.position.copy(camera.position);
  visionCamera.lookAt(0, 0.4, 0);

  visionRenderer = new THREE.WebGLRenderer({ canvas: visionCanvas, antialias: true });
  visionRenderer.setSize(visionCanvas.clientWidth, visionCanvas.clientHeight);

  // 3. Lighting
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.8);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.3);
  dirLight.position.set(3, 5, 2);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  scene.add(dirLight);

  // 4. Floor Grid & Mathematical Raycast Plane
  floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  buildFloorEnvironment();

  // 5. AR Target Placement Reticle
  buildARReticle();

  // 6. Pre-spawn a Default Furniture Item
  spawnFurniture('sofa', new THREE.Vector3(0, 0, 0), 0);

  // 7. Raycasting Setup
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  canvas3D.addEventListener('mousedown', onPointerDown);
  canvas3D.addEventListener('touchstart', onTouchStart, { passive: false });
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('mouseup', onPointerUp);
  window.addEventListener('touchend', onPointerUp);

  // 8. Bind UI Elements
  bindUIEvents();

  // 9. Window Resize
  window.addEventListener('resize', onWindowResize);

  // 10. Start Animation Loop
  requestAnimationFrame(animate);
}

// Environment Floor & Room Boundary
function buildFloorEnvironment() {
  // Grid Floor simulating AR plane detection
  const gridHelper = new THREE.GridHelper(8, 32, 0x38bdf8, 0x1e293b);
  gridHelper.position.y = 0.001;
  scene.add(gridHelper);

  // Soft Shadow Receiving Floor
  const floorGeo = new THREE.PlaneGeometry(12, 12);
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.35 });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Room Boundary Perimeter Wireframe
  const roomGeo = new THREE.BoxGeometry(4.5, 2.5, 4.5);
  const roomEdges = new THREE.EdgesGeometry(roomGeo);
  const roomLine = new THREE.LineSegments(roomEdges, new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.3 }));
  roomLine.position.y = 1.25;
  scene.add(roomLine);
}

// AR Placement Reticle
function buildARReticle() {
  arReticle = new THREE.Group();

  // Outer Ring
  const ringGeo = new THREE.RingGeometry(0.25, 0.28, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  arReticle.add(ring);

  // Inner Dot
  const dotGeo = new THREE.CircleGeometry(0.04, 16);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
  const dot = new THREE.Mesh(dotGeo, dotMat);
  dot.rotation.x = -Math.PI / 2;
  arReticle.add(dot);

  // 4 Orientation Ticks
  for (let i = 0; i < 4; i++) {
    const tickGeo = new THREE.PlaneGeometry(0.02, 0.08);
    const tick = new THREE.Mesh(tickGeo, ringMat);
    tick.rotation.x = -Math.PI / 2;
    tick.rotation.z = (i * Math.PI) / 2;
    tick.position.x = Math.cos((i * Math.PI) / 2) * 0.32;
    tick.position.z = Math.sin((i * Math.PI) / 2) * 0.32;
    arReticle.add(tick);
  }

  arReticle.position.set(0, 0.005, 0.8);
  scene.add(arReticle);
}

// Procedural 3D Furniture Factory
function createFurnitureModel(type) {
  const group = new THREE.Group();
  group.userData.type = type;

  if (type === 'sofa') {
    // Nordic Sofa (1.8m x 0.8m x 0.75m)
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });

    // Seat Base
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.25, 0.8), baseMat);
    seat.position.y = 0.25;
    seat.castShadow = true;
    group.add(seat);

    // Backrest
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 0.2), baseMat);
    back.position.set(0, 0.55, -0.3);
    back.castShadow = true;
    group.add(back);

    // Left/Right Armrests
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.8), baseMat);
    armL.position.set(-0.85, 0.40, 0);
    const armR = armL.clone();
    armR.position.x = 0.85;
    group.add(armL, armR);

    // 4 Legs
    [[-0.8, -0.3], [0.8, -0.3], [-0.8, 0.3], [0.8, 0.3]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.15), legMat);
      leg.position.set(x, 0.075, z);
      group.add(leg);
    });

    group.userData.radius = 0.95;
    group.userData.displayName = "Nordic Sofa";
  } else if (type === 'chair') {
    // Ergonomic Chair (0.6m x 0.6m x 0.95m)
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), chairMat);
    seat.position.y = 0.45;
    seat.castShadow = true;
    group.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.55, 0.05), chairMat);
    back.position.set(0, 0.75, -0.22);
    back.castShadow = true;
    group.add(back);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.40), metalMat);
    pole.position.y = 0.20;
    group.add(pole);

    const starBase = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 5), metalMat);
    starBase.position.y = 0.02;
    group.add(starBase);

    group.userData.radius = 0.45;
    group.userData.displayName = "Ergonomic Chair";
  } else if (type === 'desk') {
    // Executive Desk (1.5m x 0.75m x 0.75m)
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.3 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 });

    const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.75), woodMat);
    top.position.y = 0.75;
    top.castShadow = true;
    group.add(top);

    [[-0.7, -0.32], [0.7, -0.32], [-0.7, 0.32], [0.7, 0.32]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.05), legMat);
      leg.position.set(x, 0.36, z);
      leg.castShadow = true;
      group.add(leg);
    });

    group.userData.radius = 0.85;
    group.userData.displayName = "Executive Desk";
  } else if (type === 'drawer') {
    // Modular Drawer (0.5m x 0.5m x 0.65m)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.5), bodyMat);
    body.position.y = 0.325;
    body.castShadow = true;
    group.add(body);

    for (let i = 0; i < 3; i++) {
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.17, 0.02), woodMat);
      front.position.set(0, 0.12 + i * 0.20, 0.26);
      group.add(front);
    }

    group.userData.radius = 0.45;
    group.userData.displayName = "Modular Drawer";
  } else if (type === 'lamp') {
    // Floor Lamp (0.4m x 0.4m x 1.6m)
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 });
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.1, emissive: 0xfef3c7, emissiveIntensity: 0.3 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 24), brassMat);
    base.position.y = 0.015;
    group.add(base);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 16), brassMat);
    stem.position.y = 0.75;
    group.add(stem);

    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.25, 24, 1, true), shadeMat);
    shade.position.y = 1.45;
    group.add(shade);

    group.userData.radius = 0.30;
    group.userData.displayName = "Arc Floor Lamp";
  } else if (type === 'coffee') {
    // Coffee Table (0.9m x 0.5m x 0.42m)
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6, roughness: 0.1 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7 });

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.5), glassMat);
    top.position.y = 0.42;
    top.castShadow = true;
    group.add(top);

    [[-0.4, -0.2], [0.4, -0.2], [-0.4, 0.2], [0.4, 0.2]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.40), legMat);
      leg.position.set(x, 0.20, z);
      group.add(leg);
    });

    group.userData.radius = 0.55;
    group.userData.displayName = "Coffee Table";
  }

  // Add Dynamic Selection & Clearance Bubble Ring
  const ringGeo = new THREE.RingGeometry(group.userData.radius * 0.9, group.userData.radius * 0.95, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const selectRing = new THREE.Mesh(ringGeo, ringMat);
  selectRing.rotation.x = -Math.PI / 2;
  selectRing.position.y = 0.01;
  selectRing.name = "selectRing";
  group.add(selectRing);

  return group;
}

// Spawns furniture onto AR plane
function spawnFurniture(type, position, rotationYDeg = 0) {
  const model = createFurnitureModel(type);
  model.position.copy(position);
  model.rotation.y = THREE.MathUtils.degToRad(rotationYDeg);

  scene.add(model);
  placedFurnitureList.push(model);

  selectPlacedFurniture(model);
  updatePlacedListUI();
  evaluateFurnitureClearances();

  return model;
}

function selectPlacedFurniture(model) {
  // Deselect previous
  if (selectedPlacedObject) {
    const prevRing = selectedPlacedObject.getObjectByName("selectRing");
    if (prevRing) prevRing.material.opacity = 0;
  }

  selectedPlacedObject = model;

  if (selectedPlacedObject) {
    const ring = selectedPlacedObject.getObjectByName("selectRing");
    if (ring) {
      ring.material.opacity = 0.8;
      ring.material.color.setHex(0x38bdf8);
    }
    currentRotationDeg = Math.round(THREE.MathUtils.radToDeg(selectedPlacedObject.rotation.y)) % 360;
    document.getElementById('slider-rotation').value = currentRotationDeg;
    document.getElementById('rotation-val').textContent = currentRotationDeg + '°';
  }
}

function removeSelectedFurniture() {
  if (!selectedPlacedObject) return;

  scene.remove(selectedPlacedObject);
  const idx = placedFurnitureList.indexOf(selectedPlacedObject);
  if (idx !== -1) placedFurnitureList.splice(idx, 1);

  selectedPlacedObject = null;
  updatePlacedListUI();
  evaluateFurnitureClearances();
}

// Pointer & Touch Events
function updateMouseCoords(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function onPointerDown(e) {
  if (e.button !== 0 && !e.touches) return;

  updateMouseCoords(e);
  raycaster.setFromCamera(mouse, camera);

  // Check if clicked an existing furniture object
  const intersects = raycaster.intersectObjects(placedFurnitureList, true);
  if (intersects.length > 0) {
    let root = intersects[0].object;
    while (root.parent && root.parent !== scene) {
      root = root.parent;
    }
    selectPlacedFurniture(root);
    isDraggingFurniture = true;
    controls.enabled = false; // Disable camera orbit while dragging
    return;
  }

  // If clicked on floor, move AR reticle there
  const floorHit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(floorPlane, floorHit)) {
    arReticle.position.x = floorHit.x;
    arReticle.position.z = floorHit.z;
    selectPlacedFurniture(null);
  }
}

function onTouchStart(e) {
  if (e.touches.length === 1) {
    onPointerDown(e);
  }
}

function onPointerMove(e) {
  updateMouseCoords(e);
  raycaster.setFromCamera(mouse, camera);

  const floorHit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(floorPlane, floorHit)) {
    if (isDraggingFurniture && selectedPlacedObject) {
      selectedPlacedObject.position.x = floorHit.x;
      selectedPlacedObject.position.z = floorHit.z;
      arReticle.position.x = floorHit.x;
      arReticle.position.z = floorHit.z;
      evaluateFurnitureClearances();
    } else {
      // Float AR reticle across floor surface
      arReticle.position.x = floorHit.x;
      arReticle.position.z = floorHit.z;
    }
  }
}

function onTouchMove(e) {
  if (e.touches.length === 1) {
    onPointerMove(e);
  }
}

function onPointerUp() {
  isDraggingFurniture = false;
  controls.enabled = true;
}

// SafeSight Spatial Clearance Engine for Furniture
function evaluateFurnitureClearances() {
  const alertsContainer = document.getElementById('alerts-container');
  const badge = document.getElementById('system-status');
  const minClearanceMetric = document.getElementById('metric-min-clearance');

  let minDistanceFound = Infinity;
  let hasObstruction = false;
  const clearanceAlerts = [];

  // Check pairwise distances between all placed furniture
  for (let i = 0; i < placedFurnitureList.length; i++) {
    for (let j = i + 1; j < placedFurnitureList.length; j++) {
      const objA = placedFurnitureList[i];
      const objB = placedFurnitureList[j];

      const centerDist = objA.position.distanceTo(objB.position);
      const edgeToEdgeDist = centerDist - (objA.userData.radius + objB.userData.radius);
      minDistanceFound = Math.min(minDistanceFound, Math.max(0, edgeToEdgeDist));

      if (edgeToEdgeDist < walkwayClearanceThreshold) {
        hasObstruction = true;
        clearanceAlerts.push({
          itemA: objA.userData.displayName,
          itemB: objB.userData.displayName,
          dist: edgeToEdgeDist
        });

        // Color rings red
        const ringA = objA.getObjectByName("selectRing");
        const ringB = objB.getObjectByName("selectRing");
        if (ringA) { ringA.material.color.setHex(0xff3366); ringA.material.opacity = 0.8; }
        if (ringB) { ringB.material.color.setHex(0xff3366); ringB.material.opacity = 0.8; }
      }
    }
  }

  // Update UI Alerts
  if (hasObstruction) {
    badge.className = 'system-status-badge hazard-active';
    badge.innerHTML = `<span class="status-dot">⚠️</span> WALKWAY HAZARD DETECTED`;
    minClearanceMetric.style.color = 'var(--neon-red)';
    minClearanceMetric.textContent = `${(minDistanceFound * 100).toFixed(0)} cm (Obstructed)`;

    alertsContainer.innerHTML = clearanceAlerts.map(a => `
      <div class="risk-alert-card">
        <div class="alert-title">
          <span>▲ [Critical] Walkway Passage Obstruction</span>
          <span style="font-size: 11px; opacity: 0.8;">&lt; ${(walkwayClearanceThreshold * 100).toFixed(0)}cm</span>
        </div>
        <div class="alert-metric">Clearance between ${a.itemA} and ${a.itemB}: <b>${(Math.max(0, a.dist) * 100).toFixed(1)} cm</b></div>
        <div class="alert-action">Move items apart to maintain minimum ${(walkwayClearanceThreshold * 100).toFixed(0)} cm safe walking passage.</div>
      </div>
    `).join('');
  } else {
    badge.className = 'system-status-badge';
    badge.innerHTML = `<span class="status-dot">●</span> AR PLANE DETECTED · SAFE PASSAGE CLEAR`;
    minClearanceMetric.style.color = 'var(--neon-green)';
    minClearanceMetric.textContent = isFinite(minDistanceFound) ? `${(minDistanceFound * 100).toFixed(0)} cm (Safe)` : 'Clear';

    alertsContainer.innerHTML = `
      <div style="font-size: 13px; color: var(--neon-green); padding: 12px; background: rgba(16,185,129,0.1); border: 1px solid var(--neon-green); border-radius: 8px;">
        ✓ AR floor plane mapped. Placed furniture adheres to ${(walkwayClearanceThreshold * 100).toFixed(0)}cm safety clearances.
      </div>
    `;
  }
}

function updatePlacedListUI() {
  const countSpan = document.getElementById('placed-count');
  const metricCount = document.getElementById('metric-items-count');
  const tracker = document.getElementById('entity-tracker');

  countSpan.textContent = placedFurnitureList.length;
  metricCount.textContent = `${placedFurnitureList.length} Units`;

  if (placedFurnitureList.length === 0) {
    tracker.innerHTML = `<div>No furniture placed yet. Click on the floor or tap 'Place Selected'.</div>`;
  } else {
    tracker.innerHTML = placedFurnitureList.map((item, idx) => {
      const isSel = item === selectedPlacedObject ? '<span style="color:var(--neon-cyan)">[SELECTED]</span>' : '';
      return `<div>#${idx + 1} <b>${item.userData.displayName}</b> ${isSel} @ (${item.position.x.toFixed(2)}, ${item.position.z.toFixed(2)})</div>`;
    }).join('');
  }
}

// UI Event Handlers
function bindUIEvents() {
  // Mode Switcher Tabs
  const tabFurniture = document.getElementById('tab-mode-furniture');
  const tabAntigravity = document.getElementById('tab-mode-antigravity');
  const furnitureSection = document.getElementById('furniture-controls-section');
  const antigravitySection = document.getElementById('antigravity-controls-section');

  tabFurniture.addEventListener('click', () => {
    currentMode = 'furniture';
    tabFurniture.classList.add('active');
    tabAntigravity.classList.remove('active');
    furnitureSection.style.display = 'block';
    antigravitySection.style.display = 'none';
  });

  tabAntigravity.addEventListener('click', () => {
    currentMode = 'antigravity';
    tabAntigravity.classList.add('active');
    tabFurniture.classList.remove('active');
    furnitureSection.style.display = 'none';
    antigravitySection.style.display = 'block';
  });

  // Catalog Item Selection
  const catalogItems = document.querySelectorAll('.catalog-item');
  catalogItems.forEach(item => {
    item.addEventListener('click', () => {
      catalogItems.forEach(c => c.classList.remove('selected'));
      item.classList.add('selected');
      selectedCatalogType = item.getAttribute('data-item');
    });
  });

  // Action Buttons
  document.getElementById('btn-ar-place').addEventListener('click', () => {
    spawnFurniture(selectedCatalogType, arReticle.position.clone(), currentRotationDeg);
  });

  document.getElementById('btn-ar-rotate').addEventListener('click', () => {
    if (selectedPlacedObject) {
      currentRotationDeg = (currentRotationDeg + 45) % 360;
      selectedPlacedObject.rotation.y = THREE.MathUtils.degToRad(currentRotationDeg);
      document.getElementById('slider-rotation').value = currentRotationDeg;
      document.getElementById('rotation-val').textContent = currentRotationDeg + '°';
    }
  });

  document.getElementById('btn-ar-delete').addEventListener('click', () => {
    removeSelectedFurniture();
  });

  // Camera Passthrough Toggle
  document.getElementById('btn-ar-camera').addEventListener('click', toggleCameraPassthrough);

  // Rotation Slider
  document.getElementById('slider-rotation').addEventListener('input', e => {
    currentRotationDeg = parseInt(e.target.value);
    document.getElementById('rotation-val').textContent = currentRotationDeg + '°';
    if (selectedPlacedObject) {
      selectedPlacedObject.rotation.y = THREE.MathUtils.degToRad(currentRotationDeg);
    }
  });

  // Clearance Slider
  document.getElementById('slider-clearance').addEventListener('input', e => {
    walkwayClearanceThreshold = parseInt(e.target.value) / 100;
    document.getElementById('clearance-val').textContent = e.target.value + ' cm';
    evaluateFurnitureClearances();
  });
}

// Live Webcam / Passthrough Background
async function toggleCameraPassthrough() {
  const video = document.getElementById('webcam-video');

  if (!webcamActive) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      await video.play();

      webcamTexture = new THREE.VideoTexture(video);
      scene.background = webcamTexture;
      webcamActive = true;
      document.getElementById('btn-ar-camera').innerHTML = `<span>🛑</span> Stop Camera Feed`;
    } catch (err) {
      alert("Camera access denied or unavailable. Using realistic virtual AR backdrop.");
    }
  } else {
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
    scene.background = new THREE.Color(0x0a0f1d);
    webcamActive = false;
    document.getElementById('btn-ar-camera').innerHTML = `<span>📷</span> Toggle Live Camera`;
  }
}

function onWindowResize() {
  const container = document.querySelector('.simulation-viewport');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// Render Loop
function animate(now) {
  requestAnimationFrame(animate);

  controls.update();

  // Subtle pulsing animation on AR reticle
  if (arReticle) {
    const scale = 1.0 + 0.05 * Math.sin(now * 0.005);
    arReticle.scale.set(scale, 1, scale);
  }

  renderer.render(scene, camera);

  // Secondary AR Vision Scanner View
  if (visionRenderer && visionCamera) {
    visionCamera.position.copy(camera.position);
    visionCamera.quaternion.copy(camera.quaternion);
    visionRenderer.render(visionScene, visionCamera);
  }
}
