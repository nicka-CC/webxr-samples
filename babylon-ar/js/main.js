const canvas = document.getElementById("renderCanvas");
const arButton = document.getElementById("arButton");
const debugDiv = document.getElementById("debug");
const engine = new BABYLON.Engine(canvas, true);

let scene;
let modelRoot = null;  // Родительский узел для модели

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

        // Создаем родительский узел для модели
        modelRoot = new BABYLON.TransformNode("modelRoot", scene);
        modelRoot.position = new BABYLON.Vector3(0, 0, 10);
        // Помещаем все меши под этот узел и настраиваем масштаб и позицию
        result.meshes.forEach(mesh => {
            mesh.parent = modelRoot;
            mesh.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
            mesh.position = new BABYLON.Vector3.Zero();;
        });

        debugDiv.innerHTML += "<br>Модель обернута в TransformNode 'modelRoot'";

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

    // Обработка вращения в AR режиме
    let isRotating = false;
    let lastXRotation = 0;
    let lastYRotation = 0;
    const rotationSpeed = 0.01;

    // Добавляем обработку жестов в AR
    xr.baseExperience.onPointerDownObservable.add((evt) => {
        if (evt.pickInfo?.hit) {
            isRotating = true;
            lastXRotation = modelRoot.rotation.x;
            lastYRotation = modelRoot.rotation.y;
            debugDiv.innerHTML += "<br>Начало вращения в AR";
        }
    });

    xr.baseExperience.onPointerMoveObservable.add((evt) => {
        if (isRotating && modelRoot) {
            // Используем движение указателя для вращения
            const deltaX = evt.movementX * rotationSpeed;
            const deltaY = evt.movementY * rotationSpeed;

            modelRoot.rotation.y = lastYRotation + deltaX;
            modelRoot.rotation.x = lastXRotation + deltaY;

            // Ограничиваем вращение по X
            modelRoot.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, modelRoot.rotation.x));

            const angleX = Math.round(modelRoot.rotation.x * 180 / Math.PI);
            const angleY = Math.round(modelRoot.rotation.y * 180 / Math.PI);
            debugDiv.innerHTML = `Вращение в AR: X=${angleX}°, Y=${angleY}°`;
        }
    });

    xr.baseExperience.onPointerUpObservable.add(() => {
        isRotating = false;
        debugDiv.innerHTML += "<br>Конец вращения в AR";
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
