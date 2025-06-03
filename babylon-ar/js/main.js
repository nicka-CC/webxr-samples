const canvas = document.getElementById("renderCanvas");
const arButton = document.getElementById("arButton");
const debugDiv = document.getElementById("debug");
const engine = new BABYLON.Engine(canvas, true);

const createScene = async function() {
    debugDiv.innerHTML = "Создание сцены...";
    const scene = new BABYLON.Scene(engine);
    
    // Создаем камеру для обычного просмотра
    const camera = new BABYLON.ArcRotateCamera("camera", 0, Math.PI / 3, 15, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 20;

    // Создаем свет
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    
    try {
        // Загружаем модель
        debugDiv.innerHTML += "<br>Загрузка модели...";
        const result = await BABYLON.SceneLoader.ImportMeshAsync(null, "../", "Cat.glb", scene);
        debugDiv.innerHTML += "<br>Модель загружена";
        
        // Запускаем все анимации
        if (result.animationGroups && result.animationGroups.length > 0) {
            debugDiv.innerHTML += `<br>Найдено анимаций: ${result.animationGroups.length}`;
            result.animationGroups.forEach(anim => {
                anim.play(true);
            });
        } else {
            debugDiv.innerHTML += "<br>Анимации не найдены";
        }

        // Настраиваем модель
        result.meshes.forEach(mesh => {
            mesh.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
            mesh.position = new BABYLON.Vector3(0, 0, 10);
        });

        // Проверяем поддержку AR
        debugDiv.innerHTML += "<br>Проверка поддержки AR...";
        if (navigator.xr) {
            debugDiv.innerHTML += "<br>WebXR API доступен";
            navigator.xr.isSessionSupported('immersive-ar')
                .then((supported) => {
                    debugDiv.innerHTML += `<br>AR поддерживается: ${supported}`;
                    arButton.disabled = !supported;
                    if (supported) {
                        debugDiv.innerHTML += "<br>AR доступен";
                        arButton.style.display = "block";
                    } else {
                        debugDiv.innerHTML += "<br>AR не поддерживается на этом устройстве";
                        arButton.style.display = "none";
                    }
                })
                .catch((error) => {
                    debugDiv.innerHTML += `<br>Ошибка проверки AR: ${error.message}`;
                    console.error("Ошибка проверки AR:", error);
                    arButton.disabled = true;
                });
        } else {
            debugDiv.innerHTML += "<br>WebXR API не доступен в этом браузере";
            arButton.disabled = true;
        }

    } catch (error) {
        debugDiv.innerHTML += `<br>Ошибка: ${error.message}`;
        console.error("Ошибка:", error);
    }
    
    return scene;
};

// Обработчик нажатия на кнопку AR
arButton.addEventListener("click", async () => {
    if (arButton.disabled) return;
    
    const scene = engine.scenes[0];
    if (!scene) return;

    debugDiv.innerHTML += "<br>Запуск AR...";
    
    // Создаем AR опыт
    const xr = await BABYLON.WebXRDefaultExperience.CreateAsync(scene, {
        uiOptions: {
            sessionMode: "immersive-ar"
        },
        optionalFeatures: ["hit-test"]
    });

    if (xr) {
        xr.onStateChangedObservable.add((state) => {
            if (state === BABYLON.WebXRState.IN_XR) {
                debugDiv.innerHTML += "<br>AR сессия началась";
                arButton.style.display = "none";

                // Создаем прямоугольник с отладочной информацией
                const debugPlane = BABYLON.MeshBuilder.CreatePlane("debugPlane", {
                    width: 0.5,
                    height: 0.3
                }, scene);
                
                // Создаем материал для прямоугольника
                const debugMaterial = new BABYLON.StandardMaterial("debugMaterial", scene);
                debugMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
                debugMaterial.alpha = 0.7;
                debugPlane.material = debugMaterial;

                // Создаем динамическую текстуру для отображения текста
                const debugTexture = new BABYLON.DynamicTexture("debugTexture", {
                    width: 512,
                    height: 256
                }, scene);
                debugMaterial.diffuseTexture = debugTexture;
                debugMaterial.emissiveTexture = debugTexture;
                debugMaterial.diffuseTexture.hasAlpha = true;

                // Функция обновления отладочной информации
                function updateDebug(message) {
                    // Обновляем текстуру
                    debugTexture.clear();
                    debugTexture.drawText(message, null, 40, "bold 24px Arial", "white", "transparent", true);
                    
                    // Позиционируем прямоугольник перед камерой
                    const cameraPosition = xr.baseExperience.camera.position;
                    const cameraDirection = xr.baseExperience.camera.getDirection(new BABYLON.Vector3(0, 0, 1));
                    debugPlane.position = cameraPosition.add(cameraDirection.scale(0.5));
                    debugPlane.lookAt(cameraPosition);
                }
                
                // Добавляем обработку вращения модели в AR
                let isRotating = false;
                let lastPointerX = 0;
                let lastPointerY = 0;
                let rotationSpeed = 0.01;

                // Обработка касания для вращения в AR
                xr.onPointerDownObservable.add((evt) => {
                    isRotating = true;
                    lastPointerX = evt.pointerX;
                    lastPointerY = evt.pointerY;
                    updateDebug("Начало вращения");
                });

                xr.onPointerUpObservable.add(() => {
                    isRotating = false;
                    updateDebug("Конец вращения");
                });

                xr.onPointerMoveObservable.add((evt) => {
                    if (!isRotating) return;

                    const deltaX = evt.pointerX - lastPointerX;
                    const deltaY = evt.pointerY - lastPointerY;

                    // Вращаем все меши, кроме ground и debugPlane
                    scene.meshes.forEach(mesh => {
                        if (mesh.name !== "ground" && mesh.name !== "debugPlane") {
                            // Создаем матрицу вращения
                            const rotationMatrix = BABYLON.Matrix.RotationY(deltaX * rotationSpeed)
                                .multiply(BABYLON.Matrix.RotationX(deltaY * rotationSpeed));
                            
                            // Применяем вращение к текущей позиции
                            const currentPosition = mesh.position.clone();
                            const currentRotation = mesh.rotation.clone();
                            
                            // Вращаем вокруг текущей позиции
                            const rotatedPosition = BABYLON.Vector3.TransformCoordinates(
                                currentPosition,
                                rotationMatrix
                            );
                            
                            mesh.position = rotatedPosition;
                            mesh.rotation = currentRotation.add(new BABYLON.Vector3(
                                deltaY * rotationSpeed,
                                deltaX * rotationSpeed,
                                0
                            ));
                        }
                    });

                    updateDebug(`Вращение: X=${Math.round(scene.meshes[1].rotation.x * 180 / Math.PI)}°, Y=${Math.round(scene.meshes[1].rotation.y * 180 / Math.PI)}°`);

                    lastPointerX = evt.pointerX;
                    lastPointerY = evt.pointerY;
                });

                // Добавляем возможность размещения модели по тапу
                xr.onPointerDownObservable.add((evt) => {
                    if (evt.pickInfo.hit) {
                        const hitPoint = evt.pickInfo.pickedPoint;
                        scene.meshes.forEach(mesh => {
                            if (mesh.name !== "ground" && mesh.name !== "debugPlane") {
                                const currentY = mesh.position.y;
                                mesh.position = new BABYLON.Vector3(
                                    hitPoint.x,
                                    currentY,
                                    hitPoint.z
                                );
                            }
                        });
                        updateDebug("Модель размещена");
                    }
                });
            } else if (state === BABYLON.WebXRState.NOT_IN_XR) {
                debugDiv.innerHTML += "<br>AR сессия закончилась";
                arButton.style.display = "block";
            }
        });
    }
});

window.addEventListener("resize", () => {
    engine.resize();
});

createScene().then(() => {
    engine.runRenderLoop(() => {
        engine.scenes[0].render();
    });
}); 