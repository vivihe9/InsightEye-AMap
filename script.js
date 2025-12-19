// ==========================================================
// 🔐 1. 安全配置
// ==========================================================
window._AMapSecurityConfig = {
    securityJsCode: 'YOUR_SECURITY_JS_CODE', 
};

// ==========================================================
// 🚀 2. 全局状态
// ==========================================================
let map, placeSearch, geocoder;
let currentMode = 'business'; 
let anchorMarkers = [], anchorData = []; // 蓝点
let userSelectionMarker = null;          // 红点
let connectionLine = null;               // 虚线
let currentPolygon = null;               // 区域圈
let currentScore = 0;

const STRATEGY_CONFIG = {
    'business': { 
        keyword: '写字楼|星巴克|Wagas|健身房', 
        label: '商务精英流', 
        people: '白领 / 商务精英 / 企业高管', 
        shops: '精品咖啡、西餐、买手店、高端美容',
        desc: '追踪高客单价、高商务属性区域',
        view: { pitch: 55, rotation: 30 } // 稍微降低一点俯角，看路名更清楚
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
    key: 'YOUR_AMAP_KEY', 
    version: "2.0",
    plugins: ['AMap.Scale', 'AMap.ToolBar', 'AMap.ControlBar', 'AMap.PlaceSearch', 'AMap.GeometryUtil', 'AMap.Geocoder', 'AMap.Polyline', 'AMap.Polygon', 'AMap.Marker', 'AMap.Circle']
}).then((AMap) => {
    map = new AMap.Map("container", {
        viewMode: '3D', pitch: 55, rotation: 30, zoom: 16, 
        center: [116.473188, 39.993253], 
        mapStyle: 'amap://styles/normal', 
    });

    geocoder = new AMap.Geocoder({ city: "010" });
    placeSearch = new AMap.PlaceSearch({ pageSize: 50, city: '010' }); 
    
    map.addControl(new AMap.Scale());
    map.addControl(new AMap.ToolBar({ position: 'RB', offset: new AMap.Pixel(10, 20) }));

    setupEventListeners(AMap);

    // 初始化
    map.on('complete', () => {
        updateModeUI('business');
        analyzeLocation(AMap, map.getCenter(), false); 
    });

    // 点击交互
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
        const isUserClick = !!userSelectionMarker;
        analyzeLocation(AMap, targetPoint, isUserClick);
    });

    document.getElementById('btn-export-pdf').addEventListener('click', generateReport);
    document.getElementById('btn-modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-modal-download').addEventListener('click', downloadPDF);
    document.getElementById('report-modal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
}

function updateModeUI(mode) {
    const config = STRATEGY_CONFIG[mode];
    if (config) {
        document.getElementById('info-people').innerText = config.people;
        document.getElementById('info-shops').innerText = config.shops;
    }
}

// 🧹 暴力清理
function clearMapOverlays() {
    if (userSelectionMarker) { map.remove(userSelectionMarker); userSelectionMarker = null; }
    if (connectionLine) { map.remove(connectionLine); connectionLine = null; }
    if (currentPolygon) { map.remove(currentPolygon); currentPolygon = null; }
    if (anchorMarkers.length > 0) { map.remove(anchorMarkers); anchorMarkers = []; }
    map.clearInfoWindow();
}

// ==========================================================
// 🧠 5. 核心逻辑：动态分析引擎
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

// 🔥 主函数：分析指定位置 🔥
function analyzeLocation(AMap, centerPoint, isUserClick) {
    const config = STRATEGY_CONFIG[currentMode];
    updateModeUI(currentMode);
    
    clearMapOverlays(); 

    // 绘制新红点
    if (isUserClick) {
        userSelectionMarker = new AMap.Marker({
            map: map, position: centerPoint,
            icon: new AMap.Icon({
                size: new AMap.Size(19, 31), imageSize: new AMap.Size(19, 31),
                image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png'
            }),
            animation: 'AMAP_ANIMATION_DROP', anchor: 'bottom-center',
            zIndex: 100
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
            document.getElementById('poi-count').innerText = "0 (荒漠)";
            if (isUserClick) alert("⚠️ 该区域周围 3km 内无相关资源，建议换个地方。");
        }
    });
}

// 渲染结果详情 (✨ 视野终极版：根据圈大小自动匹配缩放)
function renderAnalysisResult(AMap, centerPoint) {
    let minDistance = 99999, nearestAnchorLoc = null;
    
    // 1. 计算最近点
    anchorData.forEach(anchorLoc => {
        const dis = AMap.GeometryUtil.distance(centerPoint, anchorLoc);
        if (dis < minDistance) { minDistance = dis; nearestAnchorLoc = anchorLoc; }
    });

    // 2. 画圈
    drawSmartBoundary(AMap, centerPoint, currentMode);

    // 3. 计算分数
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
            <div style="padding:10px; width: 260px; font-family:'Segoe UI',sans-serif;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #eee; padding-bottom:8px;">
                    <span style="font-weight:bold; color:#333; font-size:15px;">${config.label}</span>
                    <span style="color:${currentScore > 70 ? '#52c41a' : '#ff4d4f'}; font-weight:800; font-size:18px;">${currentScore}分</span>
                </div>
                <div style="font-size:12px; color:#666; margin-bottom:4px;">📍 ${addressText}</div>
                <div style="font-size:12px; color:#666; margin-bottom:12px;">🔗 最近资源: <strong>${distanceText}</strong></div>
                <div class="stats-container">${statsHTML}</div>
                <div style="margin-top:12px; background:#f9f9f9; padding:8px; border-radius:4px; font-size:11px; color:#666; line-height:1.4;">
                    💡 建议：${getAdvice(currentScore)}
                </div>
            </div>`;

        const infoWindow = new AMap.InfoWindow({ isCustom: false, content: contentHTML, offset: new AMap.Pixel(0, -35) });
        infoWindow.open(map, centerPoint);

        if (nearestAnchorLoc) {
            connectionLine = new AMap.Polyline({
                map: map, path: [centerPoint, nearestAnchorLoc],
                strokeColor: "#006eff", strokeStyle: "dashed", strokeDasharray: [10, 5], zIndex: 60
            });
            
            // 🟢 核心修改：不同模式，不同 Zoom
            
            const zoomLevels = {
                'business': 16.2,  // 圈大 (500m) -> 镜头拉远，看宏观
                'community': 16.8, // 圈中 (300m) -> 镜头适中
                'traffic': 17.6    // 圈小 (150m) -> 镜头怼脸，看微观细节
            };

            // 1. 设置匹配的缩放比例
            const targetZoom = zoomLevels[currentMode] || 16.8;
            map.setZoom(targetZoom); 

            // 2. 丝滑平移到红点中心
            map.panTo(centerPoint); 
        }
    });
}

// ==========================================================
// 📐 几何算法：标准圆形辐射区
// ==========================================================
function drawSmartBoundary(AMap, centerPoint, mode) {
    if (currentPolygon) { map.remove(currentPolygon); currentPolygon = null; }

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
        strokeDasharray: [10, 10], fillColor: style.fill, fillOpacity: 0.5,
        zIndex: 40,
        clickable: false, bubble: true      
    });

    map.add(currentPolygon);
}

// ==========================================================
// 📊 辅助展示逻辑
// ==========================================================
function getStatsHTML(mode, score) {
    const indicatorsMap = {
        'business': ['商务氛围', '消费能级', '交通通达', '品牌级次', '租金回报'],
        'traffic': ['客流规模', '极速通达', '翻台潜力', '竞争蓝海', '租金友好'],
        'community': ['居住密度', '生活粘性', '复购潜力', '全龄覆盖', '竞争温和']
    };
    const labels = indicatorsMap[mode];
    let base = Math.max(2, Math.min(4.8, score / 20)); 
    let html = '';
    const values = [base, base*1.1, base*0.9, base*0.8, base*1.05].map(v => Math.min(5, v).toFixed(1));
    
    labels.forEach((label, index) => {
        const val = values[index];
        const percent = (val / 5) * 100;
        const color = percent > 80 ? '#52c41a' : (percent > 60 ? '#1890ff' : '#faad14');
        html += `
            <div class="stat-row" style="display:flex; align-items:center; margin-bottom:6px; font-size:12px;">
                <span style="width:60px; color:#555;">${label}</span>
                <div style="flex:1; height:6px; background:#eee; border-radius:3px; margin:0 8px; overflow:hidden;">
                    <div style="width:${percent}%; height:100%; background:${color}; border-radius:3px;"></div>
                </div>
                <span style="width:30px; text-align:right; font-weight:bold; color:${color};">${val}</span>
            </div>`;
    });
    return html;
}

// ==========================================================
// 📄 研报逻辑
// ==========================================================
function generateReport() {
    if (!userSelectionMarker) return alert("请先在地图上选点！");
    document.getElementById('report-modal').style.display = 'flex';
    
    document.getElementById('report-date').innerText = new Date().toLocaleDateString();
    document.getElementById('report-model').innerText = STRATEGY_CONFIG[currentMode].label;
    document.getElementById('report-score').innerText = currentScore;
    document.getElementById('report-address').innerText = document.getElementById('container').getAttribute('data-last-address');
    document.getElementById('report-anchor-count').innerText = document.getElementById('poi-count').innerText;
    document.getElementById('report-distance').innerText = document.getElementById('container').getAttribute('data-last-distance');
    document.getElementById('report-shops').innerText = STRATEGY_CONFIG[currentMode].shops;

    const ai = generateAIRules(currentMode, currentScore);
    document.getElementById('report-summary').innerText = ai.summary;
    document.getElementById('profile-people').innerText = ai.people;
    document.getElementById('profile-prefer').innerText = ai.prefer;
}

function downloadPDF() {
    const btn = document.getElementById('btn-modal-download');
    btn.innerText = "生成中..."; btn.disabled = true;
    html2pdf().set({ margin:0, filename:`慧眼研报.pdf`, image:{type:'jpeg',quality:0.98}, html2canvas:{scale:2}, jsPDF:{unit:'mm',format:'a4'} })
        .from(document.getElementById('report-content')).save().then(() => { btn.innerText = "📥 下载 PDF"; btn.disabled = false; });
}

function closeModal() { document.getElementById('report-modal').style.display = 'none'; }

function calculateScore(dis) {
    let score = 0;
    if (dis <= 50) { score = 95 + Math.random() * 4; } 
    else if (dis <= 200) { score = 95 - ((dis - 50) / 150) * 20; } 
    else if (dis <= 500) { score = 75 - ((dis - 200) / 300) * 15; } 
    else if (dis <= 1000) { score = 60 - ((dis - 500) / 500) * 20; } 
    else { score = Math.max(10, 40 - ((dis - 1000) / 1000) * 30); }
    const realityCheck = Math.random() * 12;
    score -= realityCheck;
    return Math.floor(Math.max(10, Math.min(99, score)));
}

function getAdvice(s) { 
    if (s >= 90) return "🌟 稀缺铺王！闭眼冲！";
    if (s >= 80) return "💪 优质好铺，值得拿下。";
    if (s >= 70) return "🤔 还可以，但需比对房租。";
    if (s >= 60) return "😐 勉强及格，全靠运营救。";
    return "☠️ 风险极大，建议换个地儿。"; 
}

function generateAIRules(mode, score) {
    let summary = "", people = "", prefer = ""; 
    const brands = mode === 'business' ? "星巴克" : mode === 'traffic' ? "蜜雪冰城" : "菜鸟驿站";

    if (mode === 'business') {
        prefer = "工作日 08:30 - 17:00 (刚需/社交)";
        summary = score > 80 ? `高价值商务区，周边密集${brands}，客单价潜力极高。` : `商务氛围不足，缺乏${brands}等高端锚点。`;
    } else if (mode === 'traffic') {
        prefer = "全天 11:00 - 21:00 (冲动/快捷)";
        summary = score > 80 ? `流量洼地，大量${brands}，翻台率极高。` : `流量陷阱，缺乏引流锚点，容易有价无市。`;
    } else { 
        prefer = "周末 & 晚间 17:30 - 20:30 (生活/亲子)";
        summary = score > 80 ? `成熟生活圈，密集${brands}，复购粘性极强。` : `入住率存疑，生活配套稀疏，养店周期长。`;
    }
    
    people = STRATEGY_CONFIG[mode].people;
    return { summary, people, prefer };
}