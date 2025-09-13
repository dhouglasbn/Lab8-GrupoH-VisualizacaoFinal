let rawData = [];

async function loadData() {
    const response = await fetch('electric_vehicle_analytics.csv');
    const text = await response.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',');

    rawData = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((h, i) => {
            // Tenta converter para número se possível
            let v = values[i];
            if (!isNaN(v) && v !== '') v = Number(v);
            obj[h] = v;
        });
        return obj;
    });

    // Inicializa os gráficos após carregar os dados
    updateMainChart();
    updateCostChart();
    myChart.hideLoading();
}

    // Função para filtrar dados
    function filterData() {
        const usageFilter = document.getElementById('usageFilter')?.value || 'all';
        const regionFilter = document.getElementById('regionFilter')?.value || 'all';

        return rawData.filter(row => {
            const matchesUsage = usageFilter === 'all' || row.Usage_Type === usageFilter;
            const matchesRegion = regionFilter === 'all' || row.Region === regionFilter;
            return matchesUsage && matchesRegion;
        });
    }

    // Função para obter cores baseadas na saúde da bateria
    function getBatteryColor(health) {
        if (health >= 90) return '#27ae60'; // verde
        if (health >= 80) return '#f39c12'; // laranja
        return '#e74c3c'; // vermelho
    }

    // Função para calcular tamanho do ponto (resale value)
    function getPointSize(resale) {
        return Math.sqrt(resale / 1000); // Escala logarítmica suave
    }

    // =============================
    // INICIAR GRAFICO ECHARTS
    // =============================
    const dom = document.getElementById('container');
    const myChart = echarts.init(dom, null, {
        renderer: 'canvas',
        useDirtyRect: false
    });

    myChart.showLoading();

    // Criar controles de filtro DINÂMICAMENTE (abaixo do container)
    const controlsDiv = document.createElement('div');
    controlsDiv.innerHTML = `
        <div style="margin: 20px 0; padding: 15px; background-color: #ecf0f1; border-radius: 8px; display: flex; flex-wrap: wrap; gap: 20px;">
            <div style="display: flex; flex-direction: column; min-width: 200px;">
                <label style="font-weight: bold; margin-bottom: 5px; color: #2c3e50;">Filtrar por Tipo de Uso:</label>
                <select id="usageFilter">
                    <option value="all">Todos</option>
                    <option value="Fleet">Frota</option>
                    <option value="Personal">Pessoal</option>
                    <option value="Commercial">Comercial</option>
                </select>
            </div>
            <div style="display: flex; flex-direction: column; min-width: 200px;">
                <label style="font-weight: bold; margin-bottom: 5px; color: #2c3e50;">Filtrar por Região:</label>
                <select id="regionFilter">
                    <option value="all">Todas</option>
                    <option value="Asia">Ásia</option>
                    <option value="Australia">Austrália</option>
                    <option value="North America">América do Norte</option>
                    <option value="Europe">Europa</option>
                </select>
            </div>
            <div style="display: flex; flex-direction: column; min-width: 200px;">
                <label style="font-weight: bold; margin-bottom: 5px; color: #2c3e50;">Mostrar Custos Mensais:</label>
                <input type="checkbox" id="showCosts" checked>
                <label for="showCosts" style="margin-left: 5px; vertical-align: middle;">Ativar gráfico de custos</label>
            </div>
        </div>
    `;
    // Insere os controles logo após o container
    dom.parentNode.insertBefore(controlsDiv, dom.nextSibling);

    // Criar legenda abaixo dos controles
    const legendDiv = document.createElement('div');
    legendDiv.innerHTML = `
        <div style="display: flex; justify-content: center; margin: 15px 0; flex-wrap: wrap; gap: 20px;">
            <div style="display: flex; align-items: center; margin: 0 10px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #27ae60; margin-right: 5px;"></div>
                <span>Saúde da Bateria > 90%</span>
            </div>
            <div style="display: flex; align-items: center; margin: 0 10px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #f39c12; margin-right: 5px;"></div>
                <span>80% - 90%</span>
            </div>
            <div style="display: flex; align-items: center; margin: 0 10px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #e74c3c; margin-right: 5px;"></div>
                <span>< 80%</span>
            </div>
        </div>
    `;
    dom.parentNode.insertBefore(legendDiv, controlsDiv.nextSibling);

    // Criar gráfico de custos (barra empilhada) dinamicamente
    let costChart = null;

    function updateCostChart() {
        if (!document.getElementById('showCosts')?.checked) {
            if (costChart) {
                costChart.dispose();
                costChart = null;
            }
            return;
        }

        if (!costChart) {
            const costContainer = document.createElement('div');
            costContainer.style.height = '200px';
            costContainer.style.margin = '20px 0';
            costContainer.style.border = '1px solid #ddd';
            costContainer.style.borderRadius = '8px';
            costContainer.style.overflow = 'hidden';
            costContainer.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
            dom.parentNode.insertBefore(costContainer, legendDiv.nextSibling);
            costChart = echarts.init(costContainer);
        }

        const filteredData = filterData();
        const fleetData = filteredData.filter(d => d.Usage_Type === "Fleet");
        const personalData = filteredData.filter(d => d.Usage_Type === "Personal");

        const categories = ["Custo Mensal", "Manutenção", "Seguro"];
        const fleetValues = [
            fleetData.reduce((sum, d) => sum + d.Monthly_Charging_Cost_USD, 0),
            fleetData.reduce((sum, d) => sum + d.Maintenance_Cost_USD, 0),
            fleetData.reduce((sum, d) => sum + d.Insurance_Cost_USD, 0)
        ];
        const personalValues = [
            personalData.reduce((sum, d) => sum + d.Monthly_Charging_Cost_USD, 0),
            personalData.reduce((sum, d) => sum + d.Maintenance_Cost_USD, 0),
            personalData.reduce((sum, d) => sum + d.Insurance_Cost_USD, 0)
        ];

        const option = {
            title: {
                text: 'Custos Médios por Tipo de Uso (Frota vs Pessoal)',
                left: 'center',
                textStyle: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50' }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' }
            },
            legend: {
                data: ['Frota', 'Pessoal'],
                bottom: '0%'
            },
            xAxis: {
                type: 'category',
                data: categories,
                axisLabel: { rotate: 0 }
            },
            yAxis: {
                type: 'value',
                name: 'Custo (USD)',
                nameLocation: 'middle',
                nameGap: 30
            },
            series: [
                {
                    name: 'Frota',
                    type: 'bar',
                    stack: 'total',
                    barWidth: 20,
                    data: fleetValues,
                    itemStyle: { color: '#3498db' }
                },
                {
                    name: 'Pessoal',
                    type: 'bar',
                    stack: 'total',
                    barWidth: 20,
                    data: personalValues,
                    itemStyle: { color: '#e74c3c' }
                }
            ]
        };

        costChart.setOption(option);
    }

    // Atualizar gráfico principal
    function updateMainChart() {
        const filteredData = filterData();

        const seriesData = filteredData.map(item => ({
            value: [
                item.Battery_Capacity_kWh,
                item.Range_km,
                item.Resale_Value_USD,
                item["Battery_Health_%"]
            ],
            name: `${item.Make} ${item.Model} (${item.Year})`,
            itemStyle: {
                color: getBatteryColor(item["Battery_Health_%"])
            },
            symbolSize: getPointSize(item.Resale_Value_USD),
            tooltip: {
                formatter: `
                    <b>${item.Make} ${item.Model} (${item.Year})</b><br/>
                    Região: ${item.Region}<br/>
                    Tipo: ${item.Vehicle_Type}<br/>
                    Capacidade: ${item.Battery_Capacity_kWh.toFixed(1)} kWh<br/>
                    Autonomia: ${item.Range_km} km<br/>
                    Valor de Revenda: $${item.Resale_Value_USD.toLocaleString()}<br/>
                    Saúde da Bateria: ${item["Battery_Health_%"].toFixed(1)}%<br/>
                    Custo Mensal: $${item.Monthly_Charging_Cost_USD.toFixed(2)}<br/>
                    Manutenção: $${item.Maintenance_Cost_USD}<br/>
                    Uso: ${item.Usage_Type}
                `
            }
        }));

        const option = {
            title: {
                text: 'Capacidade da Bateria vs Autonomia (tamanho = valor de revenda, cor = saúde da bateria)',
                left: 'center',
                textStyle: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50' }
            },
            tooltip: {
                show: true,
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderColor: '#ccc',
                borderWidth: 1,
                padding: 10,
                textStyle: { fontSize: 13 }
            },
            xAxis: {
                name: 'Capacidade da Bateria (kWh)',
                type: 'value',
                nameLocation: 'middle',
                nameGap: 20,
                nameTextStyle: { fontSize: 14 }
            },
            yAxis: {
                name: 'Autonomia (km)',
                type: 'value',
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: { fontSize: 14 }
            },
            visualMap: {
                show: false,
                min: 0,
                max: 100,
                dimension: 3,
                inRange: {
                    color: ['#e74c3c', '#f39c12', '#27ae60']
                }
            },
            series: [{
                type: 'scatter',
                data: seriesData,
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 0, 0, 0.3)'
                    }
                },
                symbolSize: function (val) {
                    return getPointSize(val[2]);
                },
                itemStyle: {
                    opacity: 0.8
                }
            }],
            grid: {
                left: '8%',
                right: '8%',
                top: '15%',
                bottom: '10%'
            }
        };

        myChart.setOption(option);
    }

    // Eventos de interação
    document.getElementById('usageFilter').addEventListener('change', () => {
        updateMainChart();
        updateCostChart();
    });

    document.getElementById('regionFilter').addEventListener('change', () => {
        updateMainChart();
        updateCostChart();
    });

    document.getElementById('showCosts').addEventListener('change', () => {
        updateCostChart();
    });

    // Inicializa os gráficos
    updateMainChart();
    updateCostChart();

    myChart.hideLoading();

    // Redimensionar ao resize da janela
    window.addEventListener('resize', () => {
        myChart.resize();
        if (costChart) costChart.resize();
    });


// Executar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', loadData);