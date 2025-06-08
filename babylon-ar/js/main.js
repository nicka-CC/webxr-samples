const canvas = document.getElementById("renderCanvas");
const arButton = document.getElementById("arButton");
const debugDiv = document.getElementById("debug");
const engine = new BABYLON.Engine(canvas, true);

let scene;
let modelRoot = null;  // Родительский узел для модели
let isRotating = false;
let lastX = 0;
let lastY = 0;
let rotationSpeed = 0.01;
let currentRotationX = 0;
let currentRotationY = 0;

// Добавляем переменные для анимации движения
let isMovingLeft = true;
let movementSpeed = 0.05;
let movementDistance = 3;
let currentDistance = 0;
let lookAtViewerTime = 0;
let isLookingAtViewer = false;
let movementState = 'moving'; // 'moving', 'looking', 'turning'

// Добавляем поддержку анимаций
let animations = [];
let animationMixer = null;
let currentAnimation = null;

async function createScene() {
    debugDiv.innerHTML = "Создание сцены...";
    scene = new BABYLON.Scene(engine);

    // Камера для обычного просмотра
    const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 3, 15, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 20;

    // Свет
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    try {
        debugDiv.innerHTML += "<br>Загрузка модели...";
        const result = await BABYLON.SceneLoader.ImportMeshAsync(null, "./walk2.glb", scene);
        debugDiv.innerHTML += "<br>Модель загружена";

        // Запуск анимаций, если есть
        if (result.animationGroups && result.animationGroups.length > 0) {
            debugDiv.innerHTML += `<br>Анимаций найдено: ${result.animationGroups.length}`;
            result.animationGroups.forEach(anim => {
                anim.play(true);
                debugDiv.innerHTML += `<br>Запущена анимация: ${anim.name}`;
            });
        } else {
            debugDiv.innerHTML += "<br>Анимаций нет";
        }

        // Создаем родительский узел для модели
        modelRoot = new BABYLON.TransformNode("modelRoot", scene);
        modelRoot.position = new BABYLON.Vector3(0, 0, 10);
        
        // Помещаем все меши под этот узел и настраиваем масштаб и позицию
        result.meshes.forEach(mesh => {
            mesh.parent = modelRoot;
            mesh.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
            mesh.position = new BABYLON.Vector3.Zero();
        });

        // Устанавливаем начальное положение
        modelRoot.position = new BABYLON.Vector3(0, 0, -0.5);
        modelRoot.scaling = new BABYLON.Vector3(0.1, 0.1, 0.1);

        debugDiv.innerHTML += "<br>Модель обернута в TransformNode 'modelRoot'";

        // Проверяем все анимации в сцене
        if (scene.animationGroups && scene.animationGroups.length > 0) {
            debugDiv.innerHTML += `<br>Найдены анимации в сцене: ${scene.animationGroups.length}`;
            scene.animationGroups.forEach(anim => {
                anim.play(true);
                debugDiv.innerHTML += `<br>Запущена анимация из сцены: ${anim.name}`;
            });
        }

        // Проверяем все меши на наличие анимаций
        result.meshes.forEach(mesh => {
            if (mesh.animations && mesh.animations.length > 0) {
                debugDiv.innerHTML += `<br>Найдены анимации в меше ${mesh.name}: ${mesh.animations.length}`;
                mesh.animations.forEach(anim => {
                    scene.beginAnimation(mesh, 0, 100, true);
                    debugDiv.innerHTML += `<br>Запущена анимация в меше: ${anim.name}`;
                });
            }
        });

        // Добавляем функцию обновления анимации
        scene.registerBeforeRender(() => {
            if (modelRoot) {
                switch (movementState) {
                    case 'moving':
                        if (isMovingLeft) {
                            modelRoot.position.x -= movementSpeed;
                            currentDistance += movementSpeed;
                            if (currentDistance >= movementDistance) {
                                movementState = 'turning';
                                currentDistance = 0;
                            }
                        } else {
                            modelRoot.position.x += movementSpeed;
                            currentDistance += movementSpeed;
                            if (currentDistance >= movementDistance * 2) {
                                movementState = 'turning';
                                currentDistance = 0;
                            }
                        }
                        break;

                    case 'turning':
                        if (isMovingLeft) {
                            modelRoot.rotation.y = Math.PI / 2; // 90 градусов
                            isMovingLeft = false;
                        } else {
                            modelRoot.rotation.y = -Math.PI / 2; // -90 градусов
                            isMovingLeft = true;
                        }
                        movementState = 'looking';
                        lookAtViewerTime = 0;
                        break;

                    case 'looking':
                        lookAtViewerTime += scene.getEngine().getDeltaTime() / 1000;
                        if (lookAtViewerTime >= 2) { // 2 секунды смотрит на зрителя
                            movementState = 'moving';
                        }
                        break;
                }
            }
        });

    } catch (error) {
        debugDiv.innerHTML += `<br>Ошибка загрузки модели: ${error.message}`;
        console.error(error);
    }

    return scene;
}

async function checkARSupport() {
    if (navigator.xr) {
        debugDiv.innerHTML += "<br>WebXR API доступен";
        try {
            const supported = await navigator.xr.isSessionSupported('immersive-ar');
            debugDiv.innerHTML += `<br>Поддержка AR: ${supported}`;
            if (supported) {
                arButton.disabled = false;
                arButton.style.display = "block";
            } else {
                arButton.disabled = true;
                arButton.style.display = "none";
            }
        } catch (e) {
            debugDiv.innerHTML += `<br>Ошибка проверки поддержки AR: ${e.message}`;
            arButton.disabled = true;
            arButton.style.display = "none";
        }
    } else {
        debugDiv.innerHTML += "<br>WebXR API не доступен";
        arButton.disabled = true;
        arButton.style.display = "none";
    }
}

arButton.addEventListener("click", async () => {
    if (arButton.disabled) return;
    debugDiv.innerHTML += "<br>Запуск AR сессии...";

    const xr = await BABYLON.WebXRDefaultExperience.CreateAsync(scene, {
        uiOptions: { sessionMode: "immersive-ar" },
        optionalFeatures: ["hit-test"]
    });

    // Включаем hit-test для определения поверхности
    const hitTestFeature = xr.baseExperience.featuresManager.enableFeature(BABYLON.WebXRHitTest, "latest", {
        xrController: xr.baseExperience.camera
    });

    // Индикатор точки касания (для отладки)
    const hitTestIndicator = BABYLON.MeshBuilder.CreateSphere("hitTestIndicator", { diameter: 0.05 }, scene);
    hitTestIndicator.isVisible = false;
    hitTestIndicator.material = new BABYLON.StandardMaterial("hitTestMaterial", scene);
    hitTestIndicator.material.emissiveColor = new BABYLON.Color3(1, 0, 0);

    // Обработка результатов hit-test
    hitTestFeature.onHitTestResultObservable.add((results) => {
        if (results.length) {
            const hit = results[0];
            hitTestIndicator.isVisible = true;
            hitTestIndicator.position = hit.transformationMatrix.getTranslation();
        } else {
            hitTestIndicator.isVisible = false;
        }
    });

    // Размещение модели по тапу
    xr.baseExperience.onPointerDownObservable.add((evt) => {
        if (!modelRoot) return;
        if (evt.pickInfo?.hit) {
            // Позиция точки на поверхности
            const pos = hitTestIndicator.position;
            // Сохраняем высоту модели, чтобы не зарывать в пол
            const currentY = modelRoot.position.y;
            modelRoot.position = new BABYLON.Vector3(pos.x, currentY, pos.z);
            debugDiv.innerHTML += "<br>Модель размещена на поверхности";
        }
    });

    // Создаем контроллер для управления моделью
    const modelController = new BABYLON.TransformNode("modelController", scene);
    modelRoot.parent = modelController;

    // Добавляем возможность вращения через контроллер
    const rotationController = new BABYLON.ArcRotateCamera("rotationCamera", 0, Math.PI / 2, 1, modelController.position, scene);
    rotationController.attachControl(canvas, true);
    rotationController.lowerRadiusLimit = 0.1;
    rotationController.upperRadiusLimit = 2;
    rotationController.inputs.attached.pointers.detachControl(canvas);

    // Обработка вращения в AR
    xr.baseExperience.onPointerDownObservable.add((pointerInfo) => {
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
            isRotating = true;
            lastX = pointerInfo.event.clientX;
            lastY = pointerInfo.event.clientY;
            
            // Останавливаем текущую анимацию при начале вращения
            if (currentAnimation) {
                currentAnimation.stop();
            }
            
            console.log("Начало вращения");
        }
    });

    xr.baseExperience.onPointerMoveObservable.add((pointerInfo) => {
        if (isRotating && modelRoot) {
            const deltaX = pointerInfo.event.clientX - lastX;
            const deltaY = pointerInfo.event.clientY - lastY;
            
            currentRotationY += deltaX * rotationSpeed;
            currentRotationX += deltaY * rotationSpeed;
            
            // Ограничиваем вращение по X
            currentRotationX = Math.max(-Math.PI/2, Math.min(Math.PI/2, currentRotationX));
            
            modelRoot.rotation = new BABYLON.Vector3(currentRotationX, currentRotationY, 0);
            
            lastX = pointerInfo.event.clientX;
            lastY = pointerInfo.event.clientY;
            
            console.log(`Вращение: X=${currentRotationX.toFixed(2)}, Y=${currentRotationY.toFixed(2)}`);
        }
    });

    xr.baseExperience.onPointerUpObservable.add((pointerInfo) => {
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
            isRotating = false;
            
            // Возобновляем анимацию после вращения
            if (currentAnimation) {
                currentAnimation.start(true);
            }
            
            console.log("Конец вращения");
        }
    });

    // Добавляем обработку жестов масштабирования
    let initialDistance = 0;
    let initialScale = 1;

    xr.baseExperience.onPointerDownObservable.add((evt) => {
        if (evt.pickInfo?.hit && evt.pointerEvent.touches?.length === 2) {
            initialDistance = Math.hypot(
                evt.pointerEvent.touches[0].clientX - evt.pointerEvent.touches[1].clientX,
                evt.pointerEvent.touches[0].clientY - evt.pointerEvent.touches[1].clientY
            );
            initialScale = modelRoot.scaling.x;
        }
    });

    xr.baseExperience.onPointerMoveObservable.add((evt) => {
        if (evt.pointerEvent.touches?.length === 2) {
            const currentDistance = Math.hypot(
                evt.pointerEvent.touches[0].clientX - evt.pointerEvent.touches[1].clientX,
                evt.pointerEvent.touches[0].clientY - evt.pointerEvent.touches[1].clientY
            );
            const scale = initialScale * (currentDistance / initialDistance);
            
            modelRoot.scaling = new BABYLON.Vector3(scale, scale, scale);
        }
    });

    xr.onStateChangedObservable.add(state => {
        if (state === BABYLON.WebXRState.IN_XR) {
            debugDiv.innerHTML += "<br>AR сессия началась";
            arButton.style.display = "none";
        } else if (state === BABYLON.WebXRState.NOT_IN_XR) {
            debugDiv.innerHTML += "<br>AR сессия завершена";
            arButton.style.display = "block";
        }
    });
});

window.addEventListener("resize", () => engine.resize());

createScene().then(() => {
    checkARSupport();
    engine.runRenderLoop(() => {
        if (scene) scene.render();
    });
});
