const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // 設置CORS頭
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // 獲取參數
    const stockId = event.queryStringParameters?.stock_id;
    const dataType = event.queryStringParameters?.data_type || 'financials'; // financials, price, info
    const companyType = event.queryStringParameters?.company_type || 'emerging'; // emerging, otc

    if (!stockId) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: '缺少股票代碼參數' })
        };
    }

    console.log(`TPEx API請求: ${stockId}, 類型: ${dataType}, 公司類型: ${companyType}`);

    try {
        let result;
        
        switch (dataType) {
            case 'financials':
                result = await fetchTPExFinancials(stockId, companyType);
                break;
            case 'price':
                result = await fetchTPExPrice(stockId, companyType);
                break;
            case 'info':
                result = await fetchTPExCompanyInfo(stockId, companyType);
                break;
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: '不支持的數據類型: ' + dataType })
                };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('TPEx API錯誤:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: '獲取TPEx數據失敗',
                details: error.message,
                stock_id: stockId 
            })
        };
    }
};

// 獲取興櫃/上櫃公司財務數據
async function fetchTPExFinancials(stockId, companyType = 'emerging') {
    console.log(`獲取${companyType === 'otc' ? '上櫃' : '興櫃'}財務數據: ${stockId}`);
    
    try {
        // 注意：TPEx API可能需要具體查詢實際的公開API端點
        // 這裡使用模擬數據展示結構，需要根據實際API調整
        
        // 模擬API響應 - 實際使用時替換為真實API調用
        const mockFinancialData = {
            company_id: stockId,
            company_name: `${companyType === 'otc' ? '上櫃' : '興櫃'}公司 ${stockId}`,
            report_date: new Date().toISOString().split('T')[0],
            
            // 每股盈餘 (EPS) 數據
            eps_data: {
                current_quarter: getRandomEPS(), // 當前季度
                q1: getRandomEPS(), // 第一季度
                q2: getRandomEPS(), // 第二季度
                q3: getRandomEPS(), // 第三季度
                q4: getRandomEPS(), // 第四季度
                year_total: getRandomEPS() * 4, // 年度累計
                last_year: getRandomEPS() * 4, // 去年同期
                growth_rate: Math.random() > 0.5 ? 15.5 : -8.2 // 成長率
            },
            
            // 股東權益報酬率 (ROE)
            roe_data: {
                current: (Math.random() * 30 + 5).toFixed(2), // 當前ROE
                average: (Math.random() * 25 + 8).toFixed(2), // 平均ROE
                industry_average: '12.5' // 行業平均
            },
            
            // 營收數據
            revenue_data: {
                current_month: (Math.random() * 1000 + 500).toFixed(2), // 當月營收
                month_growth: (Math.random() * 50 - 10).toFixed(2), // 月增率
                year_growth: (Math.random() * 100 - 20).toFixed(2), // 年增率
                accumulated_year: (Math.random() * 5000 + 2000).toFixed(2) // 年度累計
            },
            
            // 毛利率
            gross_margin_data: {
                current: (Math.random() * 60 + 10).toFixed(2), // 當前毛利率
                last_quarter: (Math.random() * 60 + 10).toFixed(2), // 上季毛利率
                last_year: (Math.random() * 60 + 10).toFixed(2) // 去年同期
            },
            
            // 其他財務指標
            other_indicators: {
                debt_ratio: (Math.random() * 50 + 20).toFixed(2), // 負債比率
                current_ratio: (Math.random() * 3 + 1).toFixed(2), // 流動比率
                quick_ratio: (Math.random() * 2 + 0.5).toFixed(2), // 速動比率
                per: (Math.random() * 30 + 8).toFixed(2), // 本益比
                pbr: (Math.random() * 3 + 0.8).toFixed(2) // 股價淨值比
            },
            
            // 數據來源說明
            source: `TPEx (台灣證券交易所${companyType === 'otc' ? '上櫃' : '興櫃'}公司)`,
            last_updated: new Date().toISOString(),
            disclaimer: '此數據僅供參考，實際數據以TPEx官方公告為準'
        };

        // 轉換為統一格式（與上市公司格式兼容）
        const unifiedFormat = transformToUnifiedFormat(mockFinancialData, stockId, companyType);
        
        return {
            success: true,
            data: unifiedFormat,
            raw_data: mockFinancialData,
            source: 'TPEx',
            company_type: companyType,
            note: '此為模擬數據，需要配置真實TPEx API端點'
        };

    } catch (error) {
        console.error('獲取TPEx財務數據失敗:', error);
        
        // 返回降級數據
        return getFallbackFinancialData(stockId, companyType);
    }
}

// 獲取興櫃/上櫃公司股價數據
async function fetchTPExPrice(stockId, companyType = 'emerging') {
    console.log(`獲取${companyType === 'otc' ? '上櫃' : '興櫃'}股價數據: ${stockId}`);
    
    try {
        // 實際API調用 - 需要根據TPEx實際API調整
        // 這裡使用Yahoo Finance作為備選（興櫃/上櫃股票代碼通常加.TWO）
        const yahooSymbol = `${stockId}.TWO`;
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1mo`;
        
        const response = await fetch(yahooUrl);
        if (!response.ok) throw new Error(`Yahoo API錯誤: ${response.status}`);
        
        const data = await response.json();
        
        if (data?.chart?.result?.[0]) {
            return {
                success: true,
                symbol: yahooSymbol,
                price_data: data.chart.result[0],
                source: 'Yahoo Finance (TPEx)',
                company_type: companyType
            };
        } else {
            throw new Error('無效的股價數據');
        }
        
    } catch (error) {
        console.error('獲取TPEx股價失敗:', error);
        
        // 返回模擬數據
        return getMockPriceData(stockId, companyType);
    }
}

// 獲取興櫃/上櫃公司基本信息
async function fetchTPExCompanyInfo(stockId, companyType = 'emerging') {
    console.log(`獲取${companyType === 'otc' ? '上櫃' : '興櫃'}公司信息: ${stockId}`);
    
    try {
        // 模擬公司信息 - 實際需要調用TPEx API
        const mockInfo = {
            stock_id: stockId,
            company_name: `${companyType === 'otc' ? '上櫃' : '興櫃'}科技股份有限公司 ${stockId}`,
            industry: getRandomIndustry(),
            established_date: '2020-01-15',
            listing_date: '2023-06-30',
            capital: (Math.random() * 500 + 100).toFixed(0) + '百萬',
            chairman: '張大明',
            headquarters: '台北市內湖區科技園區',
            business_scope: '半導體設計、軟體開發、技術服務',
            website: 'https://example.com',
            employees: Math.floor(Math.random() * 300 + 50),
            market_segment: companyType === 'otc' ? '上櫃市場' : '興櫃市場'
        };
        
        return {
            success: true,
            data: mockInfo,
            source: 'TPEx',
            company_type: companyType,
            note: '此為模擬數據'
        };
        
    } catch (error) {
        console.error('獲取公司信息失敗:', error);
        return {
            success: false,
            error: '無法獲取公司信息',
            stock_id: stockId,
            company_type: companyType
        };
    }
}

// ===================== 輔助函數 =====================

// 轉換TPEx數據為統一格式
function transformToUnifiedFormat(tpexData, stockId, companyType) {
    // 統一格式（與fetch-twse.js返回的格式一致）
    return {
        eps: {
            quarters: {
                'Q1': parseFloat(tpexData.eps_data.q1 || 0),
                'Q2': parseFloat(tpexData.eps_data.q2 || 0),
                'Q3': parseFloat(tpexData.eps_data.q3 || 0),
                'Q4': parseFloat(tpexData.eps_data.q4 || 0)
            },
            year: parseFloat(tpexData.eps_data.year_total || 0)
        },
        roe: {
            quarters: {
                'Q1': parseFloat(tpexData.roe_data.current || 0),
                'Q2': parseFloat(tpexData.roe_data.current || 0),
                'Q3': parseFloat(tpexData.roe_data.current || 0),
                'Q4': parseFloat(tpexData.roe_data.current || 0)
            },
            year: parseFloat(tpexData.roe_data.current || 0)
        },
        revenueGrowth: {
            months: {
                // 模擬月度成長數據
                '11311': parseFloat(tpexData.revenue_data.month_growth || 0),
                '11312': parseFloat(tpexData.revenue_data.month_growth || 0) + 2.5,
                '11401': parseFloat(tpexData.revenue_data.month_growth || 0) + 1.8,
                '11402': parseFloat(tpexData.revenue_data.month_growth || 0) - 0.5
            },
            quarters: {
                'Q1': parseFloat(tpexData.revenue_data.year_growth || 0),
                'Q2': parseFloat(tpexData.revenue_data.year_growth || 0) + 3.2,
                'Q3': parseFloat(tpexData.revenue_data.year_growth || 0) - 1.8,
                'Q4': parseFloat(tpexData.revenue_data.year_growth || 0) + 5.6
            },
            year: parseFloat(tpexData.revenue_data.year_growth || 0)
        },
        profitMargin: {
            quarters: {
                'Q1': parseFloat(tpexData.gross_margin_data.current || 0),
                'Q2': parseFloat(tpexData.gross_margin_data.current || 0) + 1.2,
                'Q3': parseFloat(tpexData.gross_margin_data.current || 0) - 0.8,
                'Q4': parseFloat(tpexData.gross_margin_data.current || 0) + 2.3
            },
            year: parseFloat(tpexData.gross_margin_data.current || 0)
        },
        _metadata: {
            source: 'TPEx',
            stock_id: stockId,
            company_name: tpexData.company_name,
            company_type: companyType,
            transform_date: new Date().toISOString(),
            original_data_structure: 'tpex'
        }
    };
}

// 獲取降級財務數據（當API失敗時使用）
function getFallbackFinancialData(stockId, companyType = 'emerging') {
    console.log(`使用降級財務數據: ${stockId} (${companyType})`);
    
    return {
        success: true,
        data: {
            eps: {
                quarters: { 'Q1': 0.5, 'Q2': 0.8, 'Q3': 1.2, 'Q4': 1.5 },
                year: 4.0
            },
            roe: {
                quarters: { 'Q1': 8.5, 'Q2': 9.2, 'Q3': 10.1, 'Q4': 11.3 },
                year: 9.8
            },
            revenueGrowth: {
                months: {},
                quarters: { 'Q1': 12.5, 'Q2': 15.3, 'Q3': 18.7, 'Q4': 22.1 },
                year: 17.2
            },
            profitMargin: {
                quarters: { 'Q1': 25.3, 'Q2': 26.8, 'Q3': 28.1, 'Q4': 29.5 },
                year: 27.4
            },
            _metadata: {
                source: 'fallback',
                stock_id: stockId,
                company_type: companyType,
                note: 'TPEx API暫時不可用，使用默認數據'
            }
        },
        warning: 'TPEx API暫時不可用，顯示默認數據供參考'
    };
}

// 獲取模擬股價數據
function getMockPriceData(stockId, companyType = 'emerging') {
    const now = Date.now() / 1000;
    const days = 30;
    const timestamps = [];
    const closes = [];
    
    let basePrice = 50 + Math.random() * 100;
    
    for (let i = days; i >= 0; i--) {
        timestamps.push(now - (i * 86400));
        // 模擬股價波動
        const change = (Math.random() - 0.5) * 5;
        basePrice = Math.max(10, basePrice + change);
        closes.push(parseFloat(basePrice.toFixed(2)));
    }
    
    return {
        success: true,
        symbol: stockId,
        price_data: {
            timestamp: timestamps,
            indicators: {
                quote: [{
                    close: closes,
                    open: closes.map(c => c * 0.99),
                    high: closes.map(c => c * 1.02),
                    low: closes.map(c => c * 0.98),
                    volume: closes.map(() => Math.floor(Math.random() * 1000000) + 500000)
                }]
            },
            meta: {
                currency: 'TWD',
                symbol: stockId,
                exchangeName: 'TPEx',
                instrumentType: 'EQUITY',
                timezone: 'Asia/Taipei'
            }
        },
        source: 'mock',
        company_type: companyType,
        note: '模擬股價數據'
    };
}

// 隨機EPS生成
function getRandomEPS() {
    return parseFloat((Math.random() * 3 + 0.1).toFixed(2));
}

// 隨機行業
function getRandomIndustry() {
    const industries = [
        '半導體業', '電子零組件業', '電腦及週邊設備業',
        '通信網路業', '光電業', '生技醫療業',
        '軟體服務業', '文化創意業', '電子商務業'
    ];
    return industries[Math.floor(Math.random() * industries.length)];
}