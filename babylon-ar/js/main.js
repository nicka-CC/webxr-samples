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
        const result = await BABYLON.SceneLoader.ImportMeshAsync(null, "../", "untitled.glb", scene);
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
        // Создаем контейнер для модели
        const modelContainer = new BABYLON.TransformNode("modelContainer", scene);

// Добавляем все меши в контейнер
        result.meshes.forEach(mesh => {
            if (mesh !== scene.meshes[0]) { // пропускаем root-узел сцены
                mesh.parent = modelContainer;
            }
        });

// Настраиваем контейнер
        modelContainer.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
        modelContainer.position = new BABYLON.Vector3(0, 0, 10);


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
                debugDiv.innerHTML += "<br>Добавляем обработчики касаний для AR";

                let isRotating = false;
                let lastX = 0;
                const rotationSpeed = 0.005;

// Вращение по свайпу
                canvas.addEventListener("touchstart", (evt) => {
                    if (evt.touches.length === 1) {
                        isRotating = true;
                        lastX = evt.touches[0].clientX;
                        updateDebug("Начало вращения");
                    }
                }, false);

                canvas.addEventListener("touchend", () => {
                    isRotating = false;
                    updateDebug("Конец вращения");
                }, false);

                canvas.addEventListener("touchmove", (evt) => {
                    if (isRotating && evt.touches.length === 1) {
                        const deltaX = evt.touches[0].clientX - lastX;
                        lastX = evt.touches[0].clientX;

                        // Вращаем все меши кроме ground и debugPlane
                        scene.meshes.forEach(mesh => {
                            if (mesh.name !== "ground" && mesh.name !== "debugPlane") {
                                mesh.rotation.y += deltaX * rotationSpeed;
                            }
                        });

                        const angleDeg = Math.round(scene.meshes[1].rotation.y * 180 / Math.PI);
                        updateDebug(`Вращение: ${angleDeg}°`);
                    }
                }, false);

// Размещение модели по тапу в AR (оставим как было)
                xr.pointerSelection.onButtonDownObservable.add((evt) => {
                    const pickInfo = scene.pick(evt.pointerX, evt.pointerY);
                    if (pickInfo.hit) {
                        const hitPoint = pickInfo.pickedPoint;
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