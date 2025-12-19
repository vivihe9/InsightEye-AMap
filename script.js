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
let anchorMarkers = [];       // 蓝点 Marker 数组
let anchorData = [];          // 蓝点 坐标 数组
let userSelectionMarker = null; // 红点
let connectionLine = null;      // 虚线
let currentPolygon = null;      // 区域圈
let currentScore = 0;

const STRATEGY_CONFIG = {
    'business': { 
        keyword: '写字楼|星巴克|Wagas|健身房', 
        label: '商务精英流', 
        people: '白领 / 商务精英 / 企业高管', 
        shops: '精品咖啡、西餐、买手店、高端美容',
        desc: '追踪高客单价、高商务属性区域',
        view: { pitch: 55, rotation: 30 }
    },
    'traffic': { 
        keyword: '蜜雪冰城|中学|地铁站|正新鸡排', 
        label: '下沉性价比流', 
        people: '学生 / 游客 / 通勤人员', 
        shops: '奶茶店、快餐(沙县)、网吧、两元店',
        desc: '追踪高人流量、租金敏感度高区域',
        view: { pitch: 30, rotation: 0 }
    },
    'community': { 
        keyword: '小区|幼儿园|菜鸟驿站|生鲜超市', 
        label: '社区生活流', 
        people: '家庭住户 / 全职妈妈 / 老人', 
        shops: '药店、生鲜超市、干洗店、宠物店',
        desc: '追踪居住密度高、生活粘性强区域',
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
    // 性能优化：限制单页结果数量，减少 DOM 压力
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
    
    // 修复：点击阴影关闭，但点击内容区不关闭
    document.getElementById('report-modal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
}

// 🧹 彻底清理函数（解决线条残留和卡顿的关键）
function clearMapOverlays() {
    // 1. 批量移除蓝点 Marker
    if (anchorMarkers.length > 0) {
        map.remove(anchorMarkers);
        anchorMarkers = [];
    }
    // 2. 移除虚线
    if (connectionLine) {
        map.remove(connectionLine);
        connectionLine = null;
    }
    // 3. 移除圆圈
    if (currentPolygon) {
        map.remove(currentPolygon);
        currentPolygon = null;
    }
    // 4. 移除旧红点
    if (userSelectionMarker) {
        map.remove(userSelectionMarker);
        userSelectionMarker = null;
    }
    // 5. 清理信息窗体
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
    
    // 第一步：先清理，防残留
    clearMapOverlays(); 

    // 绘制新红点
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

    // 性能优化：Promise 并行请求
    Promise.all([
        searchPage(config.keyword, centerPoint, 1),
        searchPage(config.keyword, centerPoint, 2)
    ]).then(results => {
        const allPois = [...results[0], ...results[1]];
        anchorData = []; 

        if (allPois.length > 0) {
            document.getElementById('poi-count').innerText = allPois.length + " 个 (动态覆盖)";

            allPois.forEach(poi => {
                anchorData.push(poi.location);
                const marker = new AMap.Marker({
                    map: map, position: poi.location,
                    icon: new AMap.Icon({
                        size: new AMap.Size(19, 31), imageSize: new AMap.Size(19, 31),
                        image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png' 
                    }),
                    anchor: 'bottom-center',
                    label: { 
                        content: `<div class="anchor-label">${poi.name}</div>`,
                        direction: 'top', offset: new AMap.Pixel(0, -5)
                    },
                    zIndex: 50
                });
                anchorMarkers.push(marker);
            });

            if (isUserClick) {
                renderAnalysisResult(AMap, centerPoint);
            } else {
                map.setFitView(anchorMarkers, false, [60,60,60,60]);
            }
        } else {
            document.getElementById('poi-count').innerText = "0 (建议更换位置)";
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
            <div style="padding:10px; width: 260px; font-family:sans-serif;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:5px;">
                    <span style="font-weight:bold; color:#333;">${config.label}</span>
                    <span style="color:${currentScore > 70 ? '#52c41a' : '#ff4d4f'}; font-weight:800; font-size:16px;">${currentScore}分</span>
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
        borderWeight: 1, strokeColor: style.stroke, strokeOpacity: 0.8, strokeWeight: 2,
        fillColor: style.fill, fillOpacity: 0.5, zIndex: 40, bubble: true
    });
    map.add(currentPolygon);
}

// ==========================================================
// 📄 研报逻辑（修复滑动问题）
// ==========================================================
function generateReport() {
    if (!userSelectionMarker) return alert("请先在地图上选点！");
    
    // 1. 显示弹窗
    const modal = document.getElementById('report-modal');
    modal.style.display = 'block'; // 配合 CSS 的非 flex 布局使用 block
    
    // 2. 🟢 暴力禁用 body 滚动，防止滑动冲突
    document.body.classList.add('modal-open');
    
    // ... 你的其他数据填充逻辑 ...
    document.getElementById('report-content').scrollTop = 0; 
}

function closeModal() { 
    document.getElementById('report-modal').style.display = 'none'; 
    // 3. 🟢 恢复 body 滚动
    document.body.classList.remove('modal-open');
}

// 评分与建议函数保持原样...
function calculateScore(dis) { /* ...你的代码... */ }
function getStatsHTML(mode, score) { /* ...你的代码... */ }
function generateAIRules(mode, score) { /* ...你的代码... */ }
function downloadPDF() { /* ...使用 html2pdf ... */ }
function updateModeUI(mode) { /* ...你的代码... */ }

