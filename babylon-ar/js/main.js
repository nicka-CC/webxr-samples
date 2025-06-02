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
        const result = await BABYLON.SceneLoader.ImportMeshAsync(null, "./assets/models/", "untitled.glb", scene);
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
        //
        // debugDiv.innerHTML += "<br>Загрузка модели...";
        // const result2 = await BABYLON.SceneLoader.ImportMeshAsync(null, "assets/models/", "head2.glb", scene);
        // debugDiv.innerHTML += "<br>Модель загружена";
        //
        // if (result2.animationGroups && result2.animationGroups.length > 0) {
        //     debugDiv.innerHTML += `<br>Найдено анимаций: ${result2.animationGroups.length}`;
        //     result2.animationGroups.forEach(anim => {
        //         anim.play(true);
        //     });
        // } else {
        //     debugDiv.innerHTML += "<br>Анимации не найдены";
        // }
        //
        // result2.meshes.forEach(mesh => {
        //     mesh.scaling = new BABYLON.Vector3(1.1, 1.1, 1.1);
        //     mesh.position = new BABYLON.Vector3(-2.2, 2, 2.60);
        // });
        //
        // debugDiv.innerHTML += "<br>Загрузка модели...";
        // const result3 = await BABYLON.SceneLoader.ImportMeshAsync(null, "assets/models/", "knife3.glb", scene);
        // debugDiv.innerHTML += "<br>Модель загружена";
        //
        // if (result3.animationGroups && result3.animationGroups.length > 0) {
        //     debugDiv.innerHTML += `<br>Найдено анимаций: ${result3.animationGroups.length}`;
        //     result3.animationGroups.forEach(anim => {
        //         anim.play(true);
        //     });
        // } else {
        //     debugDiv.innerHTML += "<br>Анимации не найдены";
        // }
        //
        // result3.meshes.forEach(mesh => {
        //     mesh.scaling = new BABYLON.Vector3(0.9, 0.9, 0.9);
        //     mesh.position = new BABYLON.Vector3(-7.5, -0.15, 50);
        // });
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
                
                // Добавляем возможность размещения модели по тапу
                xr.onPointerDownObservable.add((evt) => {
                    if (evt.pickInfo.hit) {
                        const hitPoint = evt.pickInfo.pickedPoint;
                        scene.meshes.forEach(mesh => {
                            if (mesh.name !== "ground") {
                                const currentY = mesh.position.y;
                                mesh.position = new BABYLON.Vector3(
                                    hitPoint.x,
                                    currentY,
                                    hitPoint.z
                                );
                            }
                        });
                        debugDiv.innerHTML += "<br>Модель размещена";
                    }
                });

                // Добавляем обработку перемещения модели
                let isDragging = false;
                let selectedMesh = null;
                let lastHitPoint = null;

                xr.onPointerDownObservable.add((evt) => {
                    if (evt.pickInfo.hit) {
                        const hitMesh = evt.pickInfo.pickedMesh;
                        if (hitMesh && hitMesh.name !== "ground") {
                            isDragging = true;
                            selectedMesh = hitMesh;
                            lastHitPoint = evt.pickInfo.pickedPoint;
                        }
                    }
                });

                xr.onPointerUpObservable.add(() => {
                    isDragging = false;
                    selectedMesh = null;
                    lastHitPoint = null;
                });

                xr.onPointerMoveObservable.add((evt) => {
                    if (isDragging && selectedMesh && evt.pickInfo.hit) {
                        const hitPoint = evt.pickInfo.pickedPoint;
                        if (lastHitPoint) {
                            const deltaX = hitPoint.x - lastHitPoint.x;
                            const deltaZ = hitPoint.z - lastHitPoint.z;
                            
                            selectedMesh.position.x += deltaX;
                            selectedMesh.position.z += deltaZ;
                            
                            lastHitPoint = hitPoint;
                        }
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

// Запускаем сцену сразу
createScene().then(scene => {
    engine.runRenderLoop(() => {
        scene.render();
    });
}); 