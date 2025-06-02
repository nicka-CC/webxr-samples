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
                
                // Настраиваем начальное положение модели в AR
                scene.meshes.forEach(mesh => {
                    if (mesh.name !== "ground") {
                        mesh.position = new BABYLON.Vector3(0, 0, -0.5); // Ближе к камере
                        mesh.scaling = new BABYLON.Vector3(0.1, 0.1, 0.1); // Уменьшаем размер
                    }
                });

                // Добавляем обработку вращения и перемещения модели
                let isDragging = false;
                let selectedMesh = null;
                let lastPointerX = 0;
                let lastPointerY = 0;
                let rotationSpeed = 0.05;
                let scaleSpeed = 0.001;

                function updateDebug(message) {
                    const debugText = document.createElement('div');
                    debugText.style.position = 'fixed';
                    debugText.style.top = '10px';
                    debugText.style.left = '10px';
                    debugText.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                    debugText.style.color = 'white';
                    debugText.style.padding = '10px';
                    debugText.style.borderRadius = '5px';
                    debugText.style.zIndex = '1000';
                    debugText.textContent = message;
                    
                    const oldDebug = document.querySelector('.debug-overlay');
                    if (oldDebug) {
                        oldDebug.remove();
                    }
                    
                    debugText.classList.add('debug-overlay');
                    document.body.appendChild(debugText);
                }

                xr.onPointerDownObservable.add((evt) => {
                    updateDebug("Касание зарегистрировано");
                    
                    // Проверяем все меши в сцене
                    scene.meshes.forEach(mesh => {
                        if (mesh.name !== "ground") {
                            const ray = scene.createPickingRay(evt.pointerX, evt.pointerY, BABYLON.Matrix.Identity(), camera);
                            const hit = scene.pickWithRay(ray);
                            
                            if (hit.hit && hit.pickedMesh === mesh) {
                                updateDebug("Модель выбрана");
                                isDragging = true;
                                selectedMesh = mesh;
                                lastPointerX = evt.pointerX;
                                lastPointerY = evt.pointerY;
                            }
                        }
                    });
                });

                xr.onPointerUpObservable.add(() => {
                    if (selectedMesh) {
                        updateDebug("Модель отпущена");
                    }
                    isDragging = false;
                    selectedMesh = null;
                });

                xr.onPointerMoveObservable.add((evt) => {
                    if (!selectedMesh || !isDragging) return;

                    const deltaX = evt.pointerX - lastPointerX;
                    const deltaY = evt.pointerY - lastPointerY;

                    // Вращение модели
                    selectedMesh.rotation.y += deltaX * rotationSpeed;
                    selectedMesh.rotation.x += deltaY * rotationSpeed;

                    // Ограничиваем вращение по вертикали
                    selectedMesh.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, selectedMesh.rotation.x));

                    // Приближение/отдаление модели
                    if (evt.pointerId === 1) { // Второй палец
                        const scale = selectedMesh.scaling.x + deltaY * scaleSpeed;
                        selectedMesh.scaling = new BABYLON.Vector3(scale, scale, scale);
                        updateDebug(`Масштаб: ${Math.round(scale * 100)}%`);
                    } else {
                        updateDebug(`Вращение: X=${Math.round(selectedMesh.rotation.x * 180 / Math.PI)}°, Y=${Math.round(selectedMesh.rotation.y * 180 / Math.PI)}°`);
                    }

                    lastPointerX = evt.pointerX;
                    lastPointerY = evt.pointerY;
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