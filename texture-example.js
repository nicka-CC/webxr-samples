import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TextureManager } from './texture-loader.js';

async function loadModelWithTexture() {
    console.log('Начинаем загрузку...');
    
    // Создаем сцену
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x808080); // Серый фон для лучшей видимости
    
    // Создаем камеру
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Создаем рендерер
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild(renderer.domElement);

    // Добавляем освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Создаем менеджер текстур
    const textureManager = new TextureManager();

    try {
        console.log('Загружаем модель...');
        // Загружаем модель
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync('Cat/untitled1.glb');
        const model = gltf.scene;
        console.log('Модель загружена:', model);
        
        // Проверяем материалы модели
        model.traverse((child) => {
            if (child.isMesh) {
                console.log('Найден меш:', child.name);
                console.log('Материал:', child.material);
            }
        });

        scene.add(model);

        console.log('Загружаем текстуры...');
        // Загружаем текстуры
        const albedoTexture = await textureManager.loadTexture('Cat/texture/Cat_Material.001_AlbedoTransparency.png');
        console.log('Текстура альбедо загружена:', albedoTexture);
        
        const metallicTexture = await textureManager.loadTexture('Cat/texture/Cat_Material.001_MetallicSmoothness.png');
        console.log('Текстура металличности загружена:', metallicTexture);
        
        // Применяем текстуры к модели
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                console.log('Применяем текстуры к мешу:', child.name);
                const material = child.material;
                
                // Создаем новый материал
                const newMaterial = new THREE.MeshStandardMaterial({
                    map: albedoTexture,
                    metalnessMap: metallicTexture,
                    roughnessMap: metallicTexture,
                    metalness: 0.5,
                    roughness: 0.5
                });
                
                // Заменяем старый материал на новый
                child.material = newMaterial;
                console.log('Материал обновлен:', child.material);
            }
        });

        // Анимация
        function animate() {
            requestAnimationFrame(animate);
            model.rotation.y += 0.01;
            renderer.render(scene, camera);
        }
        animate();

    } catch (error) {
        console.error('Ошибка при загрузке модели или текстуры:', error);
    }
}

// Запускаем пример
loadModelWithTexture(); 