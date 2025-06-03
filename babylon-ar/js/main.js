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

    let isRotating = false;
    let lastX = 0;
    const rotationSpeed = 0.005;

    // Отключаем камеру Babylon.js при AR
    xr.baseExperience.camera.detachControl(canvas);

    canvas.addEventListener("touchstart", (evt) => {
        if (evt.touches.length === 1) {
            isRotating = true;
            lastX = evt.touches[0].clientX;
            debugDiv.innerHTML += "<br>Начало вращения";
        }
    }, false);

    canvas.addEventListener("touchend", () => {
        isRotating = false;
        debugDiv.innerHTML += "<br>Конец вращения";
    }, false);

    canvas.addEventListener("touchmove", (evt) => {
        if (isRotating && evt.touches.length === 1) {
            const deltaX = evt.touches[0].clientX - lastX;
            lastX = evt.touches[0].clientX;

            scene.meshes.forEach(mesh => {
                if (mesh.name !== "ground" && mesh.name !== "debugPlane") {
                    mesh.rotation.y += deltaX * rotationSpeed;
                }
            });

            const angleDeg = Math.round(scene.meshes[1].rotation.y * 180 / Math.PI);
            debugDiv.innerHTML = `Вращение: ${angleDeg}°`;
        }
    }, false);

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
