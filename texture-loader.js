import * as THREE from 'three';

export class TextureManager {
    constructor() {
        this.textureLoader = new THREE.TextureLoader();
    }

    // Загрузка текстуры из файла
    loadTexture(url) {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    // Настройка параметров текстуры
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.encoding = THREE.sRGBEncoding;
                    resolve(texture);
                },
                undefined,
                (error) => reject(error)
            );
        });
    }

    // Применение текстуры к материалу модели
    applyTextureToMaterial(material, texture) {
        if (material.map) {
            material.map.dispose();
        }
        material.map = texture;
        material.needsUpdate = true;
    }

    // Применение текстуры ко всем материалам модели
    applyTextureToModel(model, texture) {
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => this.applyTextureToMaterial(mat, texture));
                } else {
                    this.applyTextureToMaterial(child.material, texture);
                }
            }
        });
    }
} 