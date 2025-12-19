// ==========================================================
// 🔐 1. 安全配置
// ==========================================================
window._AMapSecurityConfig = {
    securityJsCode: 'e7d06608abad514618c7b3c2d63d12c2', 
};

// ==========================================================
// 🚀 2. 全局状态
// ==========================================================
let map, placeSearch, geocoder;
let currentMode = 'business'; 
let anchorMarkers = [];       
let anchorData = [];          
let userSelectionMarker = null; 
let connectionLine = null;      
let currentPolygon = null;      
let currentScore = 0;

const STRATEGY_CONFIG = {
    'business': { 
        keyword: '写字楼|星巴克|Wagas|健身房', 
        label: '商务精英流', 
        people: '白领 / 商务精英 / 企业高管', 
        shops: '精品咖啡、西餐、买手店、高端美容',
        view: { pitch: 55, rotation: 30 }
    },
    'traffic': { 
        keyword: '蜜雪冰城|中学|地铁站|正新鸡排', 
        label: '下沉性价比流', 
        people: '学生 / 游客 / 通勤人员', 
        shops: '奶茶店、快餐(沙县)、网吧、两元店',
        view: { pitch: 30, rotation: 0 }
    },
    'community': { 
        keyword: '小区|幼儿园|菜鸟驿站|生鲜超市', 
        label: '社区生活流', 
        people: '家庭住户 / 全职妈妈 / 老人', 
        shops: '药店、生鲜超市、干洗店、宠物店',
        view: { pitch: 45, rotation: 15 }
    }
};

// ==========================================================
// 🛠️ 3. 初始化地图
// ==========================================================
AMapLoader.load({
    key: 'fc33a935ba8de6c6e5c573419d0d386e', 
    version: "2.0",
    plugins: ['AMap.Scale', 'AMap.ToolBar', 'AMap.ControlBar', 'AMap.PlaceSearch', 'AMap.GeometryUtil', 'AMap.Geocoder', 'AMap.Polyline', 'AMap.Polygon', 'AMap.Marker', 'AMap.Circle']
}).then((AMap) => {
    map = new AMap.Map("container", {
        viewMode: '3D', pitch: 55, rotation: 30, zoom: 16, 
        center: [116.473188, 39.993253], 
        mapStyle: 'amap://styles/normal', 
    });

    geocoder = new AMap.Geocoder({ city: "010" });
    placeSearch = new AMap.PlaceSearch({ pageSize: 30, city: '010' }); 
    
    map.addControl(new AMap.Scale());
    map.addControl(new AMap.ToolBar({ position: 'RB', offset: new AMap.Pixel(10, 20) }));

    setupEventListeners(AMap);

    map.on('complete', () => {
        updateModeUI('business');
        analyzeLocation(AMap, map.getCenter(), false); 
    });

    map.on('click', (e) => {
        analyzeLocation(AMap, e.lnglat, true); 
    });

}).catch((e) => console.error("地图加载失败:", e));

// ==========================================================
// 🎮 4. 交互控制
// ==========================================================
function setupEventListeners(AMap) {
    document.getElementById('mode-selector').addEventListener('change', (e) => {
        currentMode = e.target.value;
        const targetPoint = userSelectionMarker ? userSelectionMarker.getPosition() : map.getCenter();
        analyzeLocation(AMap, targetPoint, !!userSelectionMarker);
    });

    document.getElementById('btn-export-pdf').addEventListener('click', generateReport);
    document.getElementById('btn-modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-modal-download').addEventListener('click', downloadPDF);
    
    document.getElementById('report-modal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
}

function clearMapOverlays() {
    if (anchorMarkers.length > 0) { map.remove(anchorMarkers); anchorMarkers = []; }
    if (connectionLine) { map.remove(connectionLine); connectionLine = null; }
    if (currentPolygon) { map.remove(currentPolygon); currentPolygon = null; }
    if (userSelectionMarker) { map.remove(userSelectionMarker); userSelectionMarker = null; }
    map.clearInfoWindow();
}

// ==========================================================
// 🧠 5. 核心逻辑
// ==========================================================
function searchPage(keyword, center, pageIndex) {
    return new Promise((resolve) => {
        placeSearch.setPageIndex(pageIndex);
        placeSearch.searchNearBy(keyword, center, 3000, (status, result) => { 
            if (status === 'complete' && result.info === 'OK') resolve(result.poiList.pois);
            else resolve([]);
        });
    });
}

function analyzeLocation(AMap, centerPoint, isUserClick) {
    const config = STRATEGY_CONFIG[currentMode];
    clearMapOverlays(); 

    if (isUserClick) {
        userSelectionMarker = new AMap.Marker({
            map: map, position: centerPoint,
            icon: new AMap.Icon({
                size: new AMap.Size(19, 31), imageSize: new AMap.Size(19, 31),
                image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png'
            }),
            animation: 'AMAP_ANIMATION_DROP', anchor: 'bottom-center', zIndex: 100
        });
    }

    document.getElementById('poi-count').innerText = "AI 动态扫描中...";

    Promise.all([
        searchPage(config.keyword, centerPoint, 1),
        searchPage(config.keyword, centerPoint, 2)
    ]).then(results => {
        const allPois = [...results[0], ...results[1]];
        anchorData = []; 

        if (allPois.length > 0) {
            document.getElementById('poi-count').innerText = allPois.length + " 个";
            allPois.forEach(poi => {
                anchorData.push(poi.location);
                const marker = new AMap.Marker({
                    map: map, position: poi.location,
                    icon: new AMap.Icon({
                        size: new AMap.Size(19, 31), imageSize: new AMap.Size(19, 31),
                        image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png' 
                    }),
                    anchor: 'bottom-center',
                    label: { content: `<div class="anchor-label">${poi.name}</div>`, direction: 'top', offset: new AMap.Pixel(0, -5) },
                    zIndex: 50
                });
                anchorMarkers.push(marker);
            });

            if (isUserClick) renderAnalysisResult(AMap, centerPoint);
            else map.setFitView(anchorMarkers, false, [60,60,60,60]);
        } else {
            document.getElementById('poi-count').innerText = "0 (荒漠区域)";
        }
    });
}

function renderAnalysisResult(AMap, centerPoint) {
    let minDistance = 99999, nearestAnchorLoc = null;
    anchorData.forEach(anchorLoc => {
        const dis = AMap.GeometryUtil.distance(centerPoint, anchorLoc);
        if (dis < minDistance) { minDistance = dis; nearestAnchorLoc = anchorLoc; }
    });

    drawSmartBoundary(AMap, centerPoint, currentMode);
    currentScore = calculateScore(minDistance);
    const distanceText = minDistance > 5000 ? ">5km" : Math.round(minDistance) + " 米";

    geocoder.getAddress(centerPoint, (status, result) => {
        let addressText = status === 'complete' ? result.regeocode.formattedAddress.replace('北京市', '') : "未知位置";
        const container = document.getElementById('container');
        container.setAttribute('data-last-address', addressText);
        container.setAttribute('data-last-distance', distanceText);

        const config = STRATEGY_CONFIG[currentMode];
        const statsHTML = getStatsHTML(currentMode, currentScore);
        const contentHTML = `
            <div style="padding:10px; width: 260px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-weight:bold;">${config.label}</span>
                    <span style="color:${currentScore > 70 ? '#52c41a' : '#ff4d4f'}; font-weight:800;">${currentScore}分</span>
                </div>
                <div style="font-size:12px; color:#666;">📍 ${addressText}</div>
                <div style="font-size:12px; color:#666; margin-bottom:8px;">🔗 最近资源: ${distanceText}</div>
                <div class="stats-container">${statsHTML}</div>
            </div>`;

        const infoWindow = new AMap.InfoWindow({ isCustom: false, content: contentHTML, offset: new AMap.Pixel(0, -35) });
        infoWindow.open(map, centerPoint);

        if (nearestAnchorLoc) {
            connectionLine = new AMap.Polyline({
                map: map, path: [centerPoint, nearestAnchorLoc],
                strokeColor: "#006eff", strokeStyle: "dashed", strokeDasharray: [10, 5], zIndex: 60
            });
            const zoomLevels = { 'business': 16.2, 'community': 16.8, 'traffic': 17.5 };
            map.setZoom(zoomLevels[currentMode] || 16.8); 
            map.panTo(centerPoint); 
        }
    });
}

function drawSmartBoundary(AMap, centerPoint, mode) {
    const radiusConfig = { 'business': 500, 'community': 300, 'traffic': 150 };
    const radius = radiusConfig[mode] || 300;
    const styleMap = {
        'business': { stroke: '#FFD700', fill: 'rgba(255, 215, 0, 0.15)' },
        'traffic':  { stroke: '#ff4d4f', fill: 'rgba(255, 77, 79, 0.15)' },
        'community':{ stroke: '#52c41a', fill: 'rgba(82, 196, 26, 0.15)' }
    };
    const style = styleMap[mode];
    currentPolygon = new AMap.Circle({
        center: centerPoint, radius: radius, 
        strokeColor: style.stroke, strokeWeight: 2,
        fillColor: style.fill, fillOpacity: 0.5, zIndex: 40, bubble: true
    });
    map.add(currentPolygon);
}

// ==========================================================
// 📄 研报逻辑 (数据填充补全)
// ==========================================================
function generateReport() {
    if (!userSelectionMarker) return alert("请先在地图上选点！");
    
    document.getElementById('report-modal').style.display = 'block';
    document.body.classList.add('modal-open');
    
    // 数据填充
    const config = STRATEGY_CONFIG[currentMode];
    document.getElementById('report-date').innerText = new Date().toLocaleDateString();
    document.getElementById('report-model').innerText = config.label;
    document.getElementById('report-score').innerText = currentScore;
    document.getElementById('report-address').innerText = document.getElementById('container').getAttribute('data-last-address');
    document.getElementById('report-anchor-count').innerText = document.getElementById('poi-count').innerText;
    document.getElementById('report-distance').innerText = document.getElementById('container').getAttribute('data-last-distance');
    document.getElementById('report-shops').innerText = config.shops;

    const ai = generateAIRules(currentMode, currentScore);
    document.getElementById('report-summary').innerText = ai.summary;
    document.getElementById('profile-people').innerText = ai.people;
    document.getElementById('profile-prefer').innerText = ai.prefer;
    
    document.getElementById('report-content').scrollTop = 0; 
}

function closeModal() { 
    document.getElementById('report-modal').style.display = 'none'; 
    document.body.classList.remove('modal-open');
}

function downloadPDF() {
    const btn = document.getElementById('btn-modal-download');
    btn.innerText = "正在生成..."; btn.disabled = true;
    const element = document.getElementById('report-content');
    html2pdf().set({
        margin: 10,
        filename: '慧眼商业研报.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(element).save().then(() => {
        btn.innerText = "📥 下载 PDF";
        btn.disabled = false;
    });
}

// ==========================================================
// 📊 算法工具函数
// ==========================================================
function calculateScore(dis) {
    let score = Math.max(10, 100 - (dis / 20));
    if (dis < 100) score += 5;
    return Math.floor(Math.min(99, score));
}

function getStatsHTML(mode, score) {
    const labels = ["流量指数", "竞争压力", "消费能力", "配套成熟", "配套潜力"];
    let html = '';
    labels.forEach(l => {
        const val = Math.max(20, score - Math.random() * 20);
        html += `<div style="font-size:11px; margin-top:4px;">${l}: ${val.toFixed(0)}%</div>`;
    });
    return html;
}

function generateAIRules(mode, score) {
    const ai = {
        summary: score > 80 ? "该地块极具商业潜力，核心指标表现优异。" : "该区域目前尚处于孵化期，建议谨慎入场。",
        people: STRATEGY_CONFIG[mode].people,
        prefer: mode === 'business' ? "高品质、快节奏、品牌化" : "性价比、社交、新鲜感"
    };
    return ai;
}

function updateModeUI(mode) {
    const config = STRATEGY_CONFIG[mode];
    document.getElementById('info-people').innerText = config.people;
    document.getElementById('info-shops').innerText = config.shops;
}
