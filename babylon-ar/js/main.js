const canvas = document.getElementById("renderCanvas");
const arButton = document.getElementById("arButton");
const debugDiv = document.getElementById("debug");
const engine = new BABYLON.Engine(canvas, true);

let modelContainer; // контейнер для модели

const createScene = async function() {
    debugDiv.innerHTML = "Создание сцены...";
    const scene = new BABYLON.Scene(engine);

    const camera = new BABYLON.ArcRotateCamera("camera", 0, Math.PI / 3, 15, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 20;

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    try {
        debugDiv.innerHTML += "<br>Загрузка модели...";
        const result = await BABYLON.SceneLoader.ImportMeshAsync(null, "../", "untitled.glb", scene);
        debugDiv.innerHTML += "<br>Модель загружена";

        if (result.animationGroups && result.animationGroups.length > 0) {
            result.animationGroups.forEach(anim => anim.play(true));
        }

        // Создаем контейнер для модели
        modelContainer = new BABYLON.TransformNode("modelContainer", scene);
        result.meshes.forEach(mesh => {
            if (mesh !== scene.meshes[0]) {
                mesh.parent = modelContainer;
            }
        });

        modelContainer.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
        modelContainer.position = new BABYLON.Vector3(0, 0, 10);

        debugDiv.innerHTML += "<br>Проверка поддержки AR...";
        if (navigator.xr) {
            navigator.xr.isSessionSupported('immersive-ar')
                .then((supported) => {
                    arButton.disabled = !supported;
                    arButton.style.display = supported ? "block" : "none";
                    debugDiv.innerHTML += supported ? "<br>AR доступен" : "<br>AR не поддерживается";
                })
                .catch((error) => {
                    console.error("Ошибка проверки AR:", error);
                    arButton.disabled = true;
                });
        } else {
            arButton.disabled = true;
        }

    } catch (error) {
        console.error("Ошибка:", error);
    }

    return scene;
};

arButton.addEventListener("click", async () => {
    if (arButton.disabled) return;

    const scene = engine.scenes[0];
    if (!scene) return;

    const xr = await BABYLON.WebXRDefaultExperience.CreateAsync(scene, {
        uiOptions: { sessionMode: "immersive-ar" },
        optionalFeatures: ["hit-test"]
    });

    if (xr) {
        xr.onStateChangedObservable.add((state) => {
            if (state === BABYLON.WebXRState.IN_XR) {
                let isRotating = false;
                let lastX = 0;
                const rotationSpeed = 0.005;

                // Вращение по свайпу
                canvas.addEventListener("touchstart", (evt) => {
                    if (evt.touches.length === 1) {
                        isRotating = true;
                        lastX = evt.touches[0].clientX;
                    }
                }, false);

                canvas.addEventListener("touchend", () => {
                    isRotating = false;
                }, false);

                canvas.addEventListener("touchmove", (evt) => {
                    if (isRotating && evt.touches.length === 1) {
                        const deltaX = evt.touches[0].clientX - lastX;
                        lastX = evt.touches[0].clientX;
                        modelContainer.rotation.y += deltaX * rotationSpeed;
                    }
                }, false);

                // Перемещение модели по тапу
                xr.pointerSelection.onButtonDownObservable.add((evt) => {
                    const pickInfo = scene.pick(evt.pointerX, evt.pointerY);
                    if (pickInfo.hit) {
                        modelContainer.position.x = pickInfo.pickedPoint.x;
                        modelContainer.position.z = pickInfo.pickedPoint.z;
                    }
                });

            } else if (state === BABYLON.WebXRState.NOT_IN_XR) {
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
