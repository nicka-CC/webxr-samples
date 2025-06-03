const canvas = document.getElementById("renderCanvas");
const arButton = document.getElementById("arButton");
const debugDiv = document.getElementById("debug");
const engine = new BABYLON.Engine(canvas, true);

let modelContainer;

const createScene = async function() {
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera("camera", 0, Math.PI / 3, 10, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    // Контейнер для модели
    modelContainer = new BABYLON.TransformNode("modelContainer", scene);

    // Загружаем кота
    const result = await BABYLON.SceneLoader.ImportMeshAsync(null, "../", "untitled.glb", scene);
    result.meshes.forEach(mesh => {
        if (mesh.name !== "__root__") {
            mesh.parent = modelContainer;
        }
    });

    // Позиция и масштаб кота
    modelContainer.position = new BABYLON.Vector3(0, 0, 0);
    modelContainer.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);

    // Проверка AR
    if (navigator.xr) {
        navigator.xr.isSessionSupported('immersive-ar').then(supported => {
            if (supported) {
                arButton.style.display = "block";
                debugDiv.innerHTML += "<br>AR доступен";
            } else {
                debugDiv.innerHTML += "<br>AR недоступен";
            }
        });
    }

    return scene;
};

arButton.addEventListener("click", async () => {
    const scene = engine.scenes[0];
    const xr = await BABYLON.WebXRDefaultExperience.CreateAsync(scene, {
        uiOptions: { sessionMode: "immersive-ar" },
        optionalFeatures: ["hit-test"]
    });

    xr.onStateChangedObservable.add((state) => {
        if (state === BABYLON.WebXRState.IN_XR) {
            let isRotating = false;
            let lastX = 0;

            canvas.addEventListener("touchstart", (evt) => {
                if (evt.touches.length === 1) {
                    isRotating = true;
                    lastX = evt.touches[0].clientX;
                }
            });

            canvas.addEventListener("touchend", () => {
                isRotating = false;
            });

            canvas.addEventListener("touchmove", (evt) => {
                if (isRotating && evt.touches.length === 1) {
                    const deltaX = evt.touches[0].clientX - lastX;
                    lastX = evt.touches[0].clientX;
                    modelContainer.rotation.y += deltaX * 0.005;
                    debugDiv.innerHTML = `Вращение: ${Math.round(modelContainer.rotation.y * 180 / Math.PI)}°`;
                }
            });

            // Тап — перемещение кота
            xr.pointerSelection.onButtonDownObservable.add((evt) => {
                const pickInfo = scene.pick(evt.pointerX, evt.pointerY);
                if (pickInfo.hit) {
                    modelContainer.position.x = pickInfo.pickedPoint.x;
                    modelContainer.position.z = pickInfo.pickedPoint.z;
                }
            });
        }
    });
});

window.addEventListener("resize", () => {
    engine.resize();
});

createScene().then(() => {
    engine.runRenderLoop(() => {
        engine.scenes[0].render();
    });
});
