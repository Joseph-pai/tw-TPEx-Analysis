const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    const type = event.queryStringParameters?.type;
    const stockId = event.queryStringParameters?.stock_id;

    console.log(`TPEx API 收到請求: type=${type}, stock_id=${stockId}`);

    try {
        switch (type) {
            case 'stocks':
                return await getTPExStocks(headers);
            case 'financials':
                return await getTPExFinancials(stockId, headers);
            case 'monthly_revenue':
                return await getTPExMonthlyRevenue(stockId, headers);
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid type parameter' })
                };
        }
    } catch (error) {
        console.error('TPEx API錯誤:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// 獲取TPEx興櫃公司列表
async function getTPExStocks(headers) {
    try {
        // TPEx興櫃公司基本資料API
        const response = await fetch('https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_L');
        
        if (!response.ok) {
            throw new Error(`TPEx API返回錯誤: ${response.status}`);
        }

        const data = await response.json();
        
        if (!Array.isArray(data)) {
            throw new Error('TPEx API返回數據格式錯誤');
        }

        // 轉換TPEx數據格式為統一的格式
        const formattedStocks = data.map(stock => {
            // TPEx使用"公司代號"或"Code"
            const code = stock['公司代號'] || stock.Code || '';
            const name = stock['公司名稱'] || stock['公司簡稱'] || stock.Name || '';
            const industry = stock['產業別'] || '其他';
            
            return {
                stock_id: code,
                stock_name: name,
                industry_category: industry,
                is_TPEx: true // 標記為TPEx公司
            };
        }).filter(stock => stock.stock_id && stock.stock_name);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(formattedStocks)
        };
    } catch (error) {
        console.error('獲取TPEx股票列表錯誤:', error);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify([]) // 返回空數組而不是錯誤
        };
    }
}

// 獲取TPEx公司財務數據
async function getTPExFinancials(stockId, headers) {
    try {
        console.log(`獲取TPEx財務數據: ${stockId}`);
        
        // TPEx提供多個財務API，我們需要並行獲取
        const [incomeData, balanceData, monthlyRevenue] = await Promise.all([
            // 綜合損益表
            fetch(`https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap06_${getTPExStockType(stockId)}`)
                .then(r => r.ok ? r.json() : [])
                .catch(() => []),
            
            // 資產負債表
            fetch(`https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap07_${getTPExStockType(stockId)}`)
                .then(r => r.ok ? r.json() : [])
                .catch(() => []),
            
            // 月營收
            fetch(`https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_L`)
                .then(r => r.ok ? r.json() : [])
                .catch(() => [])
        ]);

        console.log(`TPEx數據統計: 損益表 ${incomeData.length}, 資產負債表 ${balanceData.length}, 月營收 ${monthlyRevenue.length}`);

        // 過濾指定股票的數據
        const filteredIncome = Array.isArray(incomeData) ? 
            incomeData.filter(row => row['公司代號'] === stockId) : [];
        const filteredBalance = Array.isArray(balanceData) ? 
            balanceData.filter(row => row['公司代號'] === stockId) : [];
        const filteredRevenue = Array.isArray(monthlyRevenue) ? 
            monthlyRevenue.filter(row => row['公司代號'] === stockId) : [];

        // 解析結構化數據
        const result = parseTPExFinancialData(filteredIncome, filteredBalance, filteredRevenue);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('獲取TPEx財務數據錯誤:', error);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                eps: { quarters: {}, year: null },
                roe: { quarters: {}, year: null },
                revenueGrowth: { months: {}, quarters: {}, year: null },
                profitMargin: { quarters: {}, year: null },
                _source: 'TPEx',
                _error: error.message
            })
        };
    }
}

// 根據股票代碼獲取TPEx股票類型
function getTPExStockType(stockId) {
    // TPEx API使用不同的後綴：
    // L_ci - 證券
    // L_fh - 期貨
    // L_bd - 銀行
    // L_ins - 保險
    // 這裡我們默認使用證券類型
    return 'L_ci';
}

// 解析TPEx財務數據為統一格式
function parseTPExFinancialData(incomeData, balanceData, revenueData) {
    const result = {
        eps: { quarters: {}, year: null },
        roe: { quarters: {}, year: null },
        revenueGrowth: { months: {}, quarters: {}, year: null },
        profitMargin: { quarters: {}, year: null },
        _source: 'TPEx',
        _debug: {
            incomeCount: incomeData.length,
            balanceCount: balanceData.length,
            revenueCount: revenueData.length
        }
    };

    // === 解析EPS ===
    incomeData.forEach(row => {
        const year = row['年度'];
        const quarter = row['季別'];
        const epsRaw = row['基本每股盈餘（元）'] || row['每股盈餘'];
        
        if (!epsRaw || epsRaw === '' || epsRaw === '-') return;
        
        const eps = parseFloat(String(epsRaw).replace(/,/g, ''));
        if (isNaN(eps)) return;

        if (quarter && quarter !== '0') {
            result.eps.quarters[`Q${quarter}`] = eps;
        } else if (quarter === '0') {
            result.eps.year = eps;
        }
    });

    // === 解析ROE ===
    incomeData.forEach(incomeRow => {
        const year = incomeRow['年度'];
        const quarter = incomeRow['季別'];
        
        // 尋找淨利數據
        let netIncomeRaw = incomeRow['淨利（淨損）歸屬於母公司業主'] || 
                          incomeRow['本期淨利（淨損）'] ||
                          incomeRow['稅後淨利（淨損）'];
        
        if (!netIncomeRaw || netIncomeRaw === '' || netIncomeRaw === '-') return;
        
        const netIncome = parseFloat(String(netIncomeRaw).replace(/,/g, ''));
        if (isNaN(netIncome)) return;

        // 尋找對應的股東權益
        const balanceRow = balanceData.find(b => 
            b['年度'] === year && b['季別'] === quarter
        );

        if (balanceRow) {
            let equityRaw = balanceRow['權益總額'] || 
                           balanceRow['歸屬於母公司業主之權益合計'] ||
                           balanceRow['股東權益總額'];
            
            if (!equityRaw || equityRaw === '' || equityRaw === '-') return;
            
            const equity = parseFloat(String(equityRaw).replace(/,/g, ''));

            if (!isNaN(equity) && equity !== 0) {
                const roe = (netIncome / equity) * 100;

                if (quarter && quarter !== '0') {
                    result.roe.quarters[`Q${quarter}`] = parseFloat(roe.toFixed(2));
                } else if (quarter === '0') {
                    result.roe.year = parseFloat(roe.toFixed(2));
                }
            }
        }
    });

    // === 解析毛利率 ===
    incomeData.forEach(row => {
        const year = row['年度'];
        const quarter = row['季別'];
        
        const revenueRaw = row['營業收入'];
        const grossProfitRaw = row['營業毛利（毛損）淨額'] || row['營業毛利（毛損）'];
        
        if (!revenueRaw || !grossProfitRaw || 
            revenueRaw === '' || revenueRaw === '-' ||
            grossProfitRaw === '' || grossProfitRaw === '-') return;
        
        const revenue = parseFloat(String(revenueRaw).replace(/,/g, ''));
        const grossProfit = parseFloat(String(grossProfitRaw).replace(/,/g, ''));
        
        if (isNaN(revenue) || isNaN(grossProfit) || revenue === 0) return;
        
        const margin = (grossProfit / revenue) * 100;

        if (quarter && quarter !== '0') {
            result.profitMargin.quarters[`Q${quarter}`] = parseFloat(margin.toFixed(2));
        } else if (quarter === '0') {
            result.profitMargin.year = parseFloat(margin.toFixed(2));
        }
    });

    // === 解析營收成長率 ===
    if (revenueData.length > 0) {
        // 先按時間排序
        const sortedRevenue = [...revenueData].sort((a, b) => {
            const yearMonthA = a['資料年月'] || '';
            const yearMonthB = b['資料年月'] || '';
            return yearMonthB.localeCompare(yearMonthA);
        });

        // 解析月度數據
        sortedRevenue.forEach(row => {
            const yearMonth = row['資料年月']; // 格式: "11411" (民國年YYYYMM)
            const monthGrowthRaw = row['營業收入-去年同月增減(%)'] || row['月增率(%)'];
            
            if (!yearMonth || !monthGrowthRaw || monthGrowthRaw === '' || monthGrowthRaw === '-') return;
            
            const monthGrowth = parseFloat(String(monthGrowthRaw).replace(/,/g, ''));
            if (!isNaN(monthGrowth)) {
                result.revenueGrowth.months[yearMonth] = monthGrowth;
            }
        });

        // 計算年度營收成長
        if (sortedRevenue.length >= 12) {
            const currentYearTotal = sortedRevenue.slice(0, 12).reduce((sum, item) => {
                const revenue = parseFloat(String(item['營業收入-當月營收'] || '0').replace(/,/g, ''));
                return sum + (isNaN(revenue) ? 0 : revenue);
            }, 0);
            
            const lastYearTotal = sortedRevenue.slice(12, 24).reduce((sum, item) => {
                const revenue = parseFloat(String(item['營業收入1-當月營收'] || '0').replace(/,/g, ''));
                return sum + (isNaN(revenue) ? 0 : revenue);
            }, 0);
            
            if (lastYearTotal > 0) {
                const growth = ((currentYearTotal - lastYearTotal) / lastYearTotal) * 100;
                result.revenueGrowth.year = parseFloat(growth.toFixed(2));
            }
        }

        // 計算季度營收成長
        result.revenueGrowth.quarters = calculateTPExQuarterlyGrowth(sortedRevenue);
    }

    return result;
}

// 計算TPEx季度營收成長率
function calculateTPExQuarterlyGrowth(revenueData) {
    const quarters = {};
    const byYearMonth = {};

    // 按年月分組
    revenueData.forEach(row => {
        const ym = row['資料年月'];
        const revenueRaw = row['營業收入-當月營收'];
        
        if (!ym || !revenueRaw || revenueRaw === '' || revenueRaw === '-') return;
        
        const revenue = parseFloat(String(revenueRaw).replace(/,/g, ''));
        if (isNaN(revenue)) return;

        byYearMonth[ym] = (byYearMonth[ym] || 0) + revenue;
    });

    // 將民國年轉換為西元年並分組
    const byQuarter = {};
    Object.keys(byYearMonth).forEach(ym => {
        if (ym.length < 5) return;
        
        const rocYear = parseInt(ym.substring(0, 3));
        const month = parseInt(ym.substring(3, 5));
        const westYear = rocYear + 1911;
        const quarter = Math.ceil(month / 3);
        
        const key = `${westYear}Q${quarter}`;
        byQuarter[key] = (byQuarter[key] || 0) + byYearMonth[ym];
    });

    // 計算季度成長率
    const growthRates = {};
    const quarterKeys = Object.keys(byQuarter).sort();
    
    for (let i = 4; i < quarterKeys.length; i++) {
        const currentKey = quarterKeys[i];
        const previousKey = quarterKeys[i - 4]; // 去年同期
        
        const currentRevenue = byQuarter[currentKey];
        const previousRevenue = byQuarter[previousKey];
        
        if (previousRevenue && previousRevenue > 0) {
            const quarterLabel = currentKey.slice(-2); // "Q1", "Q2", etc.
            const growth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
            growthRates[quarterLabel] = parseFloat(growth.toFixed(2));
        }
    }

    return growthRates;
}

// 獲取TPEx月營收數據
async function getTPExMonthlyRevenue(stockId, headers) {
    try {
        const response = await fetch('https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_L');
        
        if (!response.ok) {
            throw new Error(`TPEx月營收API錯誤: ${response.status}`);
        }

        const data = await response.json();
        
        if (!Array.isArray(data)) {
            throw new Error('TPEx月營收數據格式錯誤');
        }

        // 過濾指定股票
        const filteredData = data.filter(row => row['公司代號'] === stockId);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(filteredData)
        };
    } catch (error) {
        console.error('獲取TPEx月營收錯誤:', error);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify([])
        };
    }
}