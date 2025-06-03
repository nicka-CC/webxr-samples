const canvas = document.getElementById("renderCanvas");
const arButton = document.getElementById("arButton");
const debugDiv = document.getElementById("debug");
const engine = new BABYLON.Engine(canvas, true);

let scene;

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
        const result = await BABYLON.SceneLoader.ImportMeshAsync(null, "../", "./untitled.glb", scene);
        debugDiv.innerHTML += "<br>Модель загружена";

        // Запуск анимаций, если есть
        if (result.animationGroups && result.animationGroups.length > 0) {
            debugDiv.innerHTML += `<br>Анимаций найдено: ${result.animationGroups.length}`;
            result.animationGroups.forEach(anim => anim.play(true));
        } else {
            debugDiv.innerHTML += "<br>Анимаций нет";
        }

        // Масштабирование и позиционирование модели
        result.meshes.forEach(mesh => {
            mesh.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
            mesh.position = new BABYLON.Vector3(0, 0, 10);
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

    // Добавляем обработку hit-test для размещения модели
    xr.baseExperience.featuresManager.enableFeature(BABYLON.WebXRHitTest, "latest", {
        xrController: xr.baseExperience.camera
    });

    // Создаем индикатор для отображения точки размещения
    const hitTestIndicator = BABYLON.MeshBuilder.CreateSphere("hitTestIndicator", {
        diameter: 0.05
    }, scene);
    hitTestIndicator.isVisible = false;
    hitTestIndicator.material = new BABYLON.StandardMaterial("hitTestMaterial", scene);
    hitTestIndicator.material.emissiveColor = new BABYLON.Color3(1, 0, 0);

    // Обработка результатов hit-test
    xr.baseExperience.featuresManager.getFeature(BABYLON.WebXRHitTest).onHitTestResultObservable.add((results) => {
        if (results.length) {
            const hit = results[0];
            hitTestIndicator.isVisible = true;
            hitTestIndicator.position = hit.transformationMatrix.getTranslation();
            
            // Размещаем модель при тапе
            xr.baseExperience.onPointerDownObservable.add((evt) => {
                if (evt.pickInfo.hit) {
                    scene.meshes.forEach(mesh => {
                        if (mesh.name !== "ground" && mesh.name !== "debugPlane" && mesh.name !== "hitTestIndicator") {
                            // Сохраняем текущую высоту модели
                            const currentY = mesh.position.y;
                            // Устанавливаем новую позицию, сохраняя высоту
                            mesh.position = new BABYLON.Vector3(
                                hit.transformationMatrix.getTranslation().x,
                                currentY,
                                hit.transformationMatrix.getTranslation().z
                            );
                        }
                    });
                    debugDiv.innerHTML += "<br>Модель размещена на поверхности";
                }
            });
        } else {
            hitTestIndicator.isVisible = false;
        }
    });

    let isRotating = false;
    let lastX = 0;
    let lastY = 0;
    const rotationSpeed = 0.003;

    // Отключаем камеру Babylon.js при AR
    xr.baseExperience.camera.detachControl(canvas);

    // Предотвращаем стандартные действия браузера
    canvas.addEventListener("touchstart", (evt) => {
        evt.preventDefault();
        if (evt.touches.length === 1) {
            isRotating = true;
            lastX = evt.touches[0].clientX;
            lastY = evt.touches[0].clientY;
            debugDiv.innerHTML += "<br>Начало вращения";
        }
    }, { passive: false });

    canvas.addEventListener("touchend", (evt) => {
        evt.preventDefault();
        isRotating = false;
        debugDiv.innerHTML += "<br>Конец вращения";
    }, { passive: false });

    canvas.addEventListener("touchmove", (evt) => {
        evt.preventDefault();
        if (isRotating && evt.touches.length === 1) {
            const deltaX = evt.touches[0].clientX - lastX;
            const deltaY = evt.touches[0].clientY - lastY;
            lastX = evt.touches[0].clientX;
            lastY = evt.touches[0].clientY;

            scene.meshes.forEach(mesh => {
                if (mesh.name !== "ground" && mesh.name !== "debugPlane") {
                    mesh.rotation.y += deltaX * rotationSpeed;
                    mesh.rotation.x += deltaY * rotationSpeed;
                }
            });

            const angleX = Math.round(scene.meshes[1].rotation.x * 180 / Math.PI);
            const angleY = Math.round(scene.meshes[1].rotation.y * 180 / Math.PI);
            debugDiv.innerHTML = `Вращение: X=${angleX}°, Y=${angleY}°`;
        }
    }, { passive: false });

    // Добавляем обработку жестов масштабирования
    let initialDistance = 0;
    let initialScale = 1;

    canvas.addEventListener("touchstart", (evt) => {
        if (evt.touches.length === 2) {
            initialDistance = Math.hypot(
                evt.touches[0].clientX - evt.touches[1].clientX,
                evt.touches[0].clientY - evt.touches[1].clientY
            );
            scene.meshes.forEach(mesh => {
                if (mesh.name !== "ground" && mesh.name !== "debugPlane") {
                    initialScale = mesh.scaling.x;
                }
            });
        }
    }, { passive: false });

    canvas.addEventListener("touchmove", (evt) => {
        if (evt.touches.length === 2) {
            const currentDistance = Math.hypot(
                evt.touches[0].clientX - evt.touches[1].clientX,
                evt.touches[0].clientY - evt.touches[1].clientY
            );
            const scale = initialScale * (currentDistance / initialDistance);
            
            scene.meshes.forEach(mesh => {
                if (mesh.name !== "ground" && mesh.name !== "debugPlane") {
                    mesh.scaling = new BABYLON.Vector3(scale, scale, scale);
                }
            });
        }
    }, { passive: false });

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
