const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // 设置CORS头
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS, POST'
    };

    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // 获取股票代码
    const stockCode = event.queryStringParameters?.stock_code || 
                     (event.body ? JSON.parse(event.body).stock_code : null);

    if (!stockCode) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: '缺少股票代码参数' })
        };
    }

    console.log(`开始检测公司类型: ${stockCode}`);

    try {
        let result = {
            stock_code: stockCode,
            type: 'not_found',
            stock_name: '',
            source: '',
            suggestions: []
        };

        // 1. 先尝试查询上市公司（TWSE）
        console.log(`尝试查询上市公司 (TWSE): ${stockCode}`);
        const listedResult = await checkListedCompany(stockCode);
        
        if (listedResult.found) {
            console.log(`✅ 找到上市公司: ${listedResult.stock_name}`);
            result.type = 'listed';
            result.stock_name = listedResult.stock_name;
            result.source = 'TWSE';
            result.suggestions = listedResult.suggestions || [];
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result)
            };
        }

        // 2. 尝试查询上櫃公司（TPEx OTC）
        console.log(`尝试查询上櫃公司 (TPEx OTC): ${stockCode}`);
        const otcResult = await checkOTCCompany(stockCode);
        
        if (otcResult.found) {
            console.log(`✅ 找到上櫃公司: ${otcResult.stock_name}`);
            result.type = 'otc';
            result.stock_name = otcResult.stock_name;
            result.source = 'TPEx_OTC';
            result.suggestions = otcResult.suggestions || [];
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result)
            };
        }

        // 3. 尝试查询興櫃公司（TPEx Emerging）
        console.log(`尝试查询興櫃公司 (TPEx Emerging): ${stockCode}`);
        const emergingResult = await checkEmergingCompany(stockCode);
        
        if (emergingResult.found) {
            console.log(`✅ 找到興櫃公司: ${emergingResult.stock_name}`);
            result.type = 'emerging';
            result.stock_name = emergingResult.stock_name;
            result.source = 'TPEx_EM';
            result.suggestions = emergingResult.suggestions || [];
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result)
            };
        }

        // 4. 如果都没找到，提供建议
        console.log(`❌ 未找到公司: ${stockCode}`);
        result.suggestions = generateSuggestions(stockCode);
        
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('检测公司类型错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: '检测公司类型失败',
                details: error.message,
                stock_code: stockCode 
            })
        };
    }
};

// 检查是否为上市公司（TWSE）
async function checkListedCompany(stockCode) {
    try {
        // 方法1: 通过TWSE API查询
        const twseUrl = 'https://openapi.twse.com.tw/v1/opendata/t187ap03_L';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(twseUrl, { 
            signal: controller.signal 
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            console.log('TWSE API请求失败，尝试方法2');
            // 方法2: 通过代码模式判断（上市公司通常是4位数字）
            if (/^\d{4}$/.test(stockCode)) {
                // 检查是否可能是上櫃或興櫃
                if (stockCode.startsWith('6')) {
                    return { 
                        found: false,
                        suggestions: ['此代码以6开头，可能是興櫃公司'] 
                    };
                }
                return { 
                    found: true, 
                    stock_name: `上市公司 ${stockCode}`,
                    suggestions: ['尝试通过FinMind或TWSE获取数据']
                };
            }
            return { found: false };
        }

        const data = await response.json();
        
        // 查找匹配的股票
        const foundStock = data.find(item => 
            item['公司代號'] === stockCode || 
            item['公司簡稱'] === stockCode ||
            item['公司名稱'] === stockCode
        );

        if (foundStock) {
            return {
                found: true,
                stock_name: foundStock['公司名稱'] || foundStock['公司簡稱'],
                stock_id: foundStock['公司代號'],
                industry: foundStock['產業別']
            };
        }

        return { found: false };
    } catch (error) {
        console.log('检查上市公司失败:', error.message);
        return { 
            found: false,
            suggestions: ['TWSE API查询失败，请手动选择公司类型']
        };
    }
}

// 检查是否为上櫃公司（TPEx OTC）
async function checkOTCCompany(stockCode) {
    try {
        // 上櫃公司查询 - 使用TPEx公开API
        const tpexUrl = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(tpexUrl, { 
            signal: controller.signal 
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            console.log('TPEx OTC API请求失败，尝试方法2');
            // 方法2: 通过代码特征判断
            if (/^\d{4}$/.test(stockCode)) {
                // 上櫃公司通常是4位数字，但不是6开头
                if (!stockCode.startsWith('6')) {
                    return { 
                        found: true, 
                        stock_name: `上櫃公司 ${stockCode}`,
                        suggestions: ['尝试通过TPEx公开资料获取数据']
                    };
                }
            }
            return { found: false };
        }

        const data = await response.json();
        
        // TPEx API返回的数据格式可能不同，需要根据实际情况调整
        if (Array.isArray(data)) {
            const foundStock = data.find(item => {
                const code = item.Code || item.Symbol || item.證券代號;
                const name = item.Name || item.公司名稱 || item.證券名稱;
                
                return code === stockCode || 
                       name === stockCode ||
                       name?.includes(stockCode);
            });

            if (foundStock) {
                return {
                    found: true,
                    stock_name: foundStock.Name || foundStock.證券名稱 || foundStock.公司名稱,
                    stock_id: foundStock.Code || foundStock.Symbol || foundStock.證券代號,
                    source: 'TPEx_OTC'
                };
            }
        }

        return { found: false };
    } catch (error) {
        console.log('检查上櫃公司失败:', error.message);
        return { 
            found: false,
            suggestions: ['TPEx OTC API查询失败，请手动选择公司类型']
        };
    }
}

// 检查是否为興櫃公司（TPEx Emerging）
async function checkEmergingCompany(stockCode) {
    try {
        // 興櫃公司查询 - 使用TPEx公開API
        const tpexUrl = 'https://www.tpex.org.tw/openapi/v1/tpex_emerging_quotes';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(tpexUrl, { 
            signal: controller.signal 
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            console.log('TPEx Emerging API请求失败，尝试方法2');
            // 方法2: 通过代码特征判断（興櫃通常是4位数字，以6开头）
            if (/^\d{4}$/.test(stockCode) && stockCode.startsWith('6')) {
                return { 
                    found: true, 
                    stock_name: `興櫃公司 ${stockCode}`,
                    suggestions: ['尝试通过TPEx公开资料获取数据']
                };
            }
            return { found: false };
        }

        const data = await response.json();
        
        if (Array.isArray(data)) {
            const foundStock = data.find(item => {
                const code = item.Code || item.Symbol || item.證券代號;
                const name = item.Name || item.公司名稱 || item.證券名稱;
                
                return code === stockCode || 
                       name === stockCode ||
                       name?.includes(stockCode);
            });

            if (foundStock) {
                return {
                    found: true,
                    stock_name: foundStock.Name || foundStock.證券名稱 || foundStock.公司名稱,
                    stock_id: foundStock.Code || foundStock.Symbol || foundStock.證券代號,
                    source: 'TPEx_EM'
                };
            }
        }

        return { found: false };
    } catch (error) {
        console.log('检查興櫃公司失败:', error.message);
        return { 
            found: false,
            suggestions: ['TPEx Emerging API查询失败，请手动选择公司类型']
        };
    }
}

// 生成搜索建议
function generateSuggestions(stockCode) {
    const suggestions = [];
    
    // 根据输入格式提供建议
    if (/^\d{4}$/.test(stockCode)) {
        suggestions.push(`尝试搜索股票代码 ${stockCode}`);
        
        // 上市公司常见代码范围
        if (!stockCode.startsWith('6')) {
            suggestions.push('可能是上市公司或上櫃公司，请手动选择类型');
        }
        
        // 興櫃公司常见代码范围
        if (stockCode.startsWith('6')) {
            suggestions.push('可能是興櫃公司，请选择"興櫃公司"类型');
        }
    } else if (stockCode.length >= 2) {
        suggestions.push(`尝试搜索公司名称包含 "${stockCode}"`);
        suggestions.push('请确认股票代码是否正确');
    }
    
    suggestions.push('建议手动选择公司类型：上市公司、上櫃公司或興櫃公司');
    suggestions.push('尝试使用完整的4位数字股票代码');
    suggestions.push('检查是否输入了正确的公司名称');
    
    return suggestions;
}