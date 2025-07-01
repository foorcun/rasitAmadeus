const fs = require('fs');

/**
 * Bir objenin tüm path ve tiplerini çıkarır
 * @param {Object} obj
 * @param {string} prefix
 * @returns {Object} { path: type }
 */
function getAllPathsAndTypes(obj, prefix = '') {
    let result = {};
    if (Array.isArray(obj)) {
        // Array ise, ilk elemanın tipini kullan
        if (obj.length > 0) {
            const sub = getAllPathsAndTypes(obj[0], prefix + '[0]');
            result = { ...result, ...sub };
        } else {
            result[prefix] = 'array';
        }
    } else if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
            const path = prefix ? prefix + '.' + key : key;
            const sub = getAllPathsAndTypes(obj[key], path);
            result = { ...result, ...sub };
        }
    } else {
        result[prefix] = typeof obj;
    }
    return result;
}

/**
 * Path ve tip bazlı karşılaştırma
 */
function validateWithReference(actual, expected) {
    const refPaths = getAllPathsAndTypes(expected);
    const actPaths = getAllPathsAndTypes(actual);

    let errors = [];

    // Eksik veya tip hatası
    for (const path in refPaths) {
        if (!(path in actPaths)) {
            errors.push(`❌ EKSİK ALAN: ${path} (tip: ${refPaths[path]})`);
        } else if (refPaths[path] !== actPaths[path]) {
            errors.push(`❌ TİP UYUMSUZLUĞU: ${path} (beklenen: ${refPaths[path]}, gelen: ${actPaths[path]})`);
        }
    }
    // Fazladan alan
    for (const path in actPaths) {
        if (!(path in refPaths)) {
            errors.push(`⚠️ FAZLADAN ALAN: ${path} (tip: ${actPaths[path]})`);
        }
    }

    // Sonuçları raporla
    if (errors.length === 0) {
        console.log('✅ Tüm path ve tipler doğru!');
    } else {
        console.log(`❌ ${errors.length} hata bulundu:\n`);
        errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error}`);
        });
    }
    // Özet
    console.log('\n📊 ÖZET:');
    console.log(`- Toplam hata sayısı: ${errors.length}`);
    console.log(`- Eksik alanlar: ${errors.filter(e => e.includes('EKSİK ALAN')).length}`);
    console.log(`- Tip uyumsuzlukları: ${errors.filter(e => e.includes('TİP UYUMSUZLUĞU')).length}`);
    console.log(`- Fazladan alanlar: ${errors.filter(e => e.includes('FAZLADAN ALAN')).length}`);

    return errors;
}

module.exports = { validateWithReference }; 