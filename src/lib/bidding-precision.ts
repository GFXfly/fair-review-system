// 纯逻辑招投标精准审查辅助引擎：
// 1) 前置确定性特征扫描雷达（浙江 21 条细则 + 招投标审查规则高频通报点）
// 2) 长标书智能脱水（仅剥离标准《通用合同条款》范本套话）与多块完整覆盖切片
// 3) 法定合规白名单与易混边界对照表（严防假阳性误报）
// 注意：严禁在此模块中 import prisma 或任何 Node/服务端专属包。

export interface DeterministicSignal {
    ruleId: string;
    ruleName: string;
    snippet: string;
    lawHint: string;
}

export interface PreparedAuditDocument {
    dehydratedText: string;
    auditChunks: string[];
    summaryForGuidance: string;
    removedBoilerplateChars: number;
    signals: DeterministicSignal[];
}

export const BIDDING_COMPLIANCE_SAFE_HARBOR_PROMPT = `
【招投标法定合规白名单与易混边界对照表（严禁误判为违规）】：
在判定任何风险前，必须先逐条核对以下 7 类常见合法合规情形，凡符合白名单且未越过红线边界的条款，**严禁报为违规**；若在审查或辩护复核阶段发现误报，应果断予以排除/驳回：

1）**政府采购限制进口产品**：
   - 【合法白名单】招标/采购文件明确写“本项目不允许采购进口产品 / 仅采购本国货物”，系执行《政府采购法》第十条法定原则，**完全合规，严禁判为限定原产地或排斥外资**。
   - 【真违规红线】仅当限制采购国内某一特定省、市、县本地产品（如“优先采购本地产品/本市品牌”）时，才构成违规。

2）**CMA / CNAS 通用检测资质标识**：
   - 【合法白名单】要求第三方检测报告带有 \`CMA\` 或 \`CNAS\` 国家通用法定认证标识（全国数千家机构具备，未锁死具体某一家机构），**属于合法通用的质量证明要求，严禁误判为指定特定检测机构**。
   - 【真违规红线】若指定具体某一家检测院所（如“须提供公安部某所检测报告”），或要求检测报告加盖生产厂家鲜章/公章、提供原厂针对本项目的授权书/售后服务承诺函，则属明确违规，必须上报。

3）**不限地域的同类项目履约业绩**：
   - 【合法白名单】要求近 3~5 年承担过同类项目业绩并赋合理分值（如 1~4 分）或设置与本项目规模匹配的最低同类业绩，只要**未限定特定行政区域（如明确写明“不限地域”“不限行政区域”或未限制省市内）、未限定特定封闭行业、金额/规模未明显超出本项目实际规模**，属于合法考察履约经验，**严禁误判为规模歧视或排斥潜在投标人**。
   - 【真违规红线】若将“本省/本市/本区/本地”工程业绩或特定区域奖项作为资格门槛或加分项，或业绩规模明显超出招标项目实际，构成违规。

4）**国家法定行业准入资质与人员执业资格**：
   - 【合法白名单】要求与工程规模匹配的法定最低施工/设计/监理资质等级、安全生产许可证、注册建造师/总监理工程师执业资格及安全 B 证，属于法定准入条件，**完全合规**。
   - 【真违规红线】仅当违法拔高资质等级（超出法定对应规模等级要求）或叠加与项目无关的行业资质时，才构成违规。

5）**法定上限内的保证金及多元保函支持**：
   - 【合法白名单】依法收取不超过法定上限的投标/履约保证金，且允许投标人自由选择银行保函、保险保单、担保保函或电子保函替代现金缴纳的，**完全合规**。
   - 【真违规红线】仅当强制只收现金或银行转账、拒收银行保函/保险保函/电子保函，或超过法定比例上限收取保证金时，才构成违规。

6）**3 个及以上参考品牌且注明“或相当于”**：
   - 【合法白名单】材料设备表列举 ≥3 个同档次参考/推荐品牌，并明确标注“或相当于（同等档次及以上）”允许其他同等品牌响应的，属于合规做法。
   - 【真违规红线】若锁死单一品牌型号，或列举了推荐/参考品牌却漏写“或相当于（同等档次及以上）”字样实质限定死品牌范围的，必须判为违规。

7）**针对工艺复杂定制品的客观生产加工设备/检测能力**：
   - 【合法白名单】确因项目特殊质量、环保、安全或定制工艺需要，列明通用生产工序设备或基础检测能力要求，**未指定设备品牌型号、评分分值合理且非歧视性门槛**的，具备客观必要性，不应机械判为高风险。
   - 【真违规红线】若要求特定品牌设备、要求自有全新设备或设置与履约无关的过重设备加分门槛，则构成违规。
`.trim();

interface RuleContext {
    sentence: string;
    fullText: string;
    sentenceStart: number;
    sentenceEnd: number;
}

interface DeterministicRule {
    ruleId: string;
    ruleName: string;
    lawHint: string;
    match: (ctx: RuleContext) => boolean;
}

const DETERMINISTIC_RULES: DeterministicRule[] = [
    {
        ruleId: 'local_presence',
        ruleName: '本地注册/分支机构/本地纳税社保限制',
        lawHint: '《浙江省招标投标领域公平竞争审查细则》禁止要求外地经营者在本地注册、设立分支机构或中标后在当地纳税、缴纳社保',
        match: ({ sentence }) => {
            if (/(?:不得要求|严禁要求|不得以在本地设立分支机构|不限制注册地|不受注册地限制|不限企业注册地)/.test(sentence)) {
                return false;
            }
            return (
                /(?:须|需|应|应当|要求|必须|承诺|中标后|成交后).{0,24}(?:在(?:本地|本省|本市|本区|本县|项目所在地|当地)|本地|本市|本区|本县|当地)(?:注册|设立|成立|设置).{0,18}(?:企业|公司|分公司|分支机构|办事处|常驻机构|机构|售后服务网点|服务网点|网点)?/.test(sentence) ||
                /(?:本地|本省|本市|本区|本县|当地)(?:注册企业|企业优先|企业方可|企业参加|纳税|缴税|缴纳社保|社保缴纳)/.test(sentence) ||
                /(?:外地|非本地|市外|省外|区外)(?:企业|供应商|投标人).{0,12}(?:不得|禁止|不予|限制|需在本地)/.test(sentence) ||
                /(?:设立|设置|设有|具备|拥有)(?:本地|本市|本区|本县|当地)(?:分公司|分支机构|办事处|售后服务网点|常驻机构|服务机构)/.test(sentence) ||
                /(?:中标后|成交后|签订合同前).{0,20}(?:在(?:当地|本地|本市|本区|本县|项目所在地)|当地|本地).{0,16}(?:注册|成立子公司|纳税|缴税|缴纳社保|开具发票)/.test(sentence)
            );
        },
    },
    {
        ruleId: 'regional_track_record',
        ruleName: '特定行政区域业绩或奖项限制',
        lawHint: '《浙江省招标投标领域公平竞争审查细则》及《公平竞争审查条例实施办法》禁止将特定行政区域的业绩、奖项作为资格条件或加分条件',
        match: ({ sentence }) => {
            if (/(?:不限地域|不限区域|不限行政区域|不限地区|全国范围内|不得限制业绩地域|不区分区域)/.test(sentence)) {
                return false;
            }
            const hasRegionalScope =
                /(?:本省|本市|本区|本县|本地|当地|省内|市内|区内|县内|特定行政区域|行政区域内|[\u4e00-\u9fa5]{1,5}(?:省|市|区|县)内(?:的)?).{0,24}(?:工程业绩|类似业绩|项目业绩|施工业绩|业绩|类似项目|奖项|荣誉|优质工程)/.test(sentence) ||
                /(?:获得|取得|荣获).{0,12}(?:本省|本市|本区|省|市|区|县)级.{0,12}(?:奖项|优质工程|荣誉).{0,16}(?:加分|得分|评分|资格|条件|要求)/.test(sentence);
            if (!hasRegionalScope) return false;
            return /(?:加分|得分|评分|分值|资格|条件|要求|门槛|提供|须|需|获得|承担|优先|中标|业绩)/.test(sentence);
        },
    },
    {
        ruleId: 'scale_financial_threshold',
        ruleName: '注册资本/资产/营收/纳税规模门槛或加分',
        lawHint: '《浙江省招标投标领域公平竞争审查细则》及《公平竞争审查条例实施办法》禁止将注册资本、资产总额、营业收入、纳税额、盈利等规模指标作为资格或加分条件',
        match: ({ sentence }) => {
            if (/(?:不得将注册资本|不得以注册资本|不得设置注册资本|不得限制企业规模)/.test(sentence)) {
                return false;
            }
            const hasScaleMetric = /(?:注册资本|注册资金|实缴资本|净资产|总资产|资产总额|营业收入|年营业收入|年均营业收入|年产值|纳税额|税收贡献|利润总额|净利润|连续盈利|规模以上|规上企业)/.test(sentence);
            if (!hasScaleMetric) return false;
            return /(?:不低于|不少于|达到|以上|超过|高于|万元|亿元|分档|加分|得分|满分|分值|优先|门槛|须|需|要求|连续[一二三四五\d]+年)/.test(sentence);
        },
    },
    {
        ruleId: 'enterprise_title_honor',
        ruleName: '特定企业称号/认定门槛或加分',
        lawHint: '《浙江省招标投标领域公平竞争审查细则》禁止以高新技术企业、专精特新、守合同重信用、著名商标、行业排名等特定称号作为资格或加分项',
        match: ({ sentence }) => {
            if (/不得将.*(?:高新技术|专精特新|著名商标|驰名商标).*(?:作为|纳入)/.test(sentence)) {
                return false;
            }
            return /(?:高新技术企业|专精特新|小巨人|创新型企业|瞪羚企业|独角兽企业|守合同重信用|重合同守信用|著名商标|驰名商标|百强企业|行业排名前|制造业单项冠军)/.test(sentence);
        },
    },
    {
        ruleId: 'credit_rating_abuse',
        ruleName: 'AAA/特定信用等级证书加分或门槛',
        lawHint: '《浙江省招标投标领域公平竞争审查细则》禁止将特定信用等级证书（如AAA信用评价、特定协会信用等级）作为资格条件或评审加分项',
        match: ({ sentence }) => {
            if (/不得将.*信用等级.*作为/.test(sentence)) {
                return false;
            }
            return (
                /(?:AAA|3A|AA\+?)(?:级)?(?:企业)?(?:信用等级|信用评价|资信等级|信用报告|信用证书)/.test(sentence) ||
                /(?:信用等级|信用评价|信用证书|资信等级|食品安全信用).{0,16}(?:AAA|3A|A级|加分|得分|分档|分值|须达到|不低于)/.test(sentence) ||
                /(?:行业协会|第三方信用).{0,12}(?:信用等级|信用评价)/.test(sentence)
            );
        },
    },
    {
        ruleId: 'commercial_insurance_tenure',
        ruleName: '商业保险连续投保年限或保额分档评分',
        lawHint: '《公平竞争审查条例实施办法》及实务标准禁止将商业保险连续投保年限、累计赔偿限额分档设置评标分值，变相限制新设经营者',
        match: ({ sentence }) => {
            if (/不得将.*投保年限.*作为/.test(sentence)) {
                return false;
            }
            return (
                /(?:连续投保|投保年限|投保期限|累计赔偿限额).{0,24}(?:保险|责任险|商业险|年|分档|加分|得分|分值)/.test(sentence) ||
                /(?:责任险|商业保险|商业险|雇主责任险|食品安全责任险|公众责任险|安全生产责任险).{0,24}(?:连续投保|投保年限|累计赔偿限额|每满|年及以上|年以上|分档|加分|得分|分值)/.test(sentence)
            );
        },
    },
    {
        ruleId: 'charity_public_welfare',
        ruleName: '慈善公益/社会责任证明挂钩评分',
        lawHint: '《公平竞争审查条例实施办法》禁止将与履行合同无关的慈善公益、捐赠、志愿服务等作为投标资格或加分条件',
        match: ({ sentence }) => {
            if (/不得将.*(?:公益|慈善).*(?:作为|纳入)/.test(sentence)) {
                return false;
            }
            return (
                /(?:社会公益|公益活动|慈善捐赠|公益捐赠|慈善事业|志愿服务|扶贫济困|爱心助学|捐款捐物|社会责任报告).{0,24}(?:加分|得分|分值|证明|材料|优先|条件|评标|每项|次)/.test(sentence) ||
                /(?:参加|参与|开展).{0,12}(?:社会公益|公益活动|慈善捐赠|志愿服务)/.test(sentence)
            );
        },
    },
    {
        ruleId: 'award_scoring_abuse',
        ruleName: '行政/行业协会奖项荣誉不适当地用于评分或准入',
        lawHint: '《浙江省招标投标领域公平竞争审查细则》要求核查奖项荣誉是否与项目具体特点相适应，禁止设置不合理的行政或行业协会奖项加分或准入条件',
        match: ({ sentence }) => {
            if (/不得将.*奖项.*作为/.test(sentence)) {
                return false;
            }
            return (
                /(?:鲁班奖|钱江杯|西湖杯|詹天佑奖|白玉兰奖|扬子杯|国家优质工程奖|部委级奖项|省级优质工程|市级优质工程|行业协会奖项|优质工程奖|示范工程奖)/.test(sentence) ||
                /(?:获|取得|荣获).{0,10}(?:省|市|区|县|行业协会).{0,8}(?:奖项|荣誉|表彰).{0,16}(?:加分|得分|分值|最高得|每项得|资格)/.test(sentence)
            );
        },
    },
    {
        ruleId: 'deposit_guarantee_restriction',
        ruleName: '限定保证金形式或排斥电子/保险保函',
        lawHint: '《招标投标领域公平竞争审查规则》及《浙江省细则》禁止限定保证金只能以现金或转账缴纳，或排斥银行保函、保险保函、电子保函',
        match: ({ sentence }) => {
            if (/(?:不得拒收|不得限制保证金形式|禁止拒收电子保函)/.test(sentence)) {
                return false;
            }
            return (
                /(?:投标保证金|履约保证金|质量保证金|保证金).{0,24}(?:仅限|只能|必须采用|只接受|仅接受|不接受|不得使用|不得采用).{0,24}(?:现金|转账|银行转账|电汇|汇款|银行保函|电子保函|保险保函|保险保单|担保保函)/.test(sentence) ||
                /(?:仅限|只能|仅接受|只接受)(?:以)?(?:现金|银行转账|电汇)(?:方式)?(?:缴纳|提交)?.{0,12}保证金/.test(sentence) ||
                /(?:不接受|拒绝接受|不得采用)(?:银行保函|电子保函|保险保单|保险保函|担保保函)/.test(sentence)
            );
        },
    },
    {
        ruleId: 'manufacturer_auth_seal',
        ruleName: '原厂授权书/厂家公章/指定特定检测所壁垒',
        lawHint: '《浙江省招标投标领域公平竞争审查细则》禁止要求提供生产厂家针对本项目的授权书、加盖厂家鲜章的检测报告或指定唯一特定检测机构',
        match: ({ sentence }) => {
            // 合法泛指 CMA / CNAS 第三方检测机构的，若不涉及厂家授权/鲜章/唯一特定机构，严禁误报
            if (!/(?:原厂|生产厂家|制造商|生产商|鲜章|公章|授权|售后服务承诺|唯一|公安部)/.test(sentence)) {
                return false;
            }
            if (/(?:不得要求提供.*(?:授权书|原厂))/.test(sentence)) {
                return false;
            }
            return (
                /(?:生产厂家|原厂|制造商|生产商).{0,20}(?:针对本项目的授权书|项目授权书|授权书|授权函|售后服务承诺函|售后服务函|盖章|公章|鲜章)/.test(sentence) ||
                /(?:检测报告|检验报告|测试报告|型式检验).{0,24}(?:加盖.{0,12}(?:厂家|生产厂家|生产商|制造商).{0,8}(?:公章|鲜章)|原厂公章|厂家鲜章)/.test(sentence) ||
                /(?:提供|出具|须附).{0,12}(?:原厂|生产厂家|制造商).{0,10}(?:授权书|授权函|售后服务承诺)/.test(sentence) ||
                /(?:指定|必须提供|须提供).{0,16}(?:公安部.{0,10}(?:检测|检验)|唯一(?:的)?(?:第三方)?检测机构|指定的第三方检测机构)/.test(sentence)
            );
        },
    },
    {
        ruleId: 'brand_lock_without_equivalent',
        ruleName: '指定品牌或推荐品牌未注明“或相当于”',
        lawHint: '《招标投标领域公平竞争审查规则》及《浙江省细则》禁止指定特定品牌型号，或列举推荐/参考品牌时未注明“或相当于（同等档次及以上）”',
        match: ({ sentence, fullText, sentenceStart, sentenceEnd }) => {
            if (/(?:不得指定|严禁指定|不得限定|严禁限定)/.test(sentence)) {
                return false;
            }
            if (/(?:指定品牌|限定品牌|必须选用|必须采用|仅限选用|只能选用|指定采用|采用单一品牌|独家品牌|指定使用.{0,12}品牌)/.test(sentence)) {
                return true;
            }
            if (/(?:推荐品牌|参考品牌|拟选品牌|品牌推荐|可选品牌|材料品牌表|设备品牌表)/.test(sentence)) {
                const nearby = fullText.slice(Math.max(0, sentenceStart - 120), Math.min(fullText.length, sentenceEnd + 180));
                if (/(?:或相当于|同等档次|同等及以上|不低于上述品牌|相当品牌|及以上档次|或相当)/.test(nearby)) {
                    return false;
                }
                return true;
            }
            return false;
        },
    },
    {
        ruleId: 'operating_years_limit',
        ruleName: '成立年限/经营年限限制新设经营者',
        lawHint: '《公平竞争审查条例》及《浙江省招标投标领域公平竞争审查细则》禁止以成立年限、注册时间、经营年限等条件限制新设企业参与竞争',
        match: ({ sentence }) => {
            if (/(?:不得以成立年限|不得限制成立年限)/.test(sentence)) {
                return false;
            }
            return (
                /(?:成立满|成立时间满|成立不少于|注册时间不少于|注册满|经营年限|存续时间|企业成立时间).{0,15}(?:[一二三四五六七八九十\d]+\s*年|年以上|及以上)/.test(sentence) ||
                /(?:须|需|要求).{0,10}(?:成立|注册|经营).{0,10}(?:满\s*\d+\s*年|不少于\s*\d+\s*年|\d+\s*年以上)/.test(sentence)
            );
        },
    },
    {
        ruleId: 'ownership_or_roster_barrier',
        ruleName: '所有制歧视或预选名录库/备选库壁垒',
        lawHint: '《公平竞争审查条例》及《招标投标领域公平竞争审查规则》禁止基于所有制形式实施歧视性待遇，或通过设置预选库、名录库、资格库限制市场准入',
        match: ({ sentence }) => {
            if (/(?:不得设置预选库|不得设立备选库|不得实施所有制歧视|不得排斥民营企业)/.test(sentence)) {
                return false;
            }
            return (
                /(?:国有企业|国企|央企|国有控股|国有独资|国有成分|公有制|民营企业).{0,16}(?:优先|加分|得分|倾斜|方可|限定|不得)/.test(sentence) ||
                /(?:仅限|必须|须|限定|已纳入|进入).{0,16}(?:入围|进入|纳入)?(?:本地|本市|本区|本县|区级|市级)?(?:备选库|名录库|资格库|预选库|供应商库|承包商库).{0,16}(?:方可|才能|参与|投标|企业|单位)/.test(sentence)
            );
        },
    },
    {
        ruleId: 'lottery_bid_determination',
        ruleName: '摇号/抓阄/抽签等随机方式定标',
        lawHint: '《招标投标领域公平竞争审查规则》禁止以摇号、抓阄、抽签等随机方式替代择优定标或非法限制招标人定标自主权',
        match: ({ sentence }) => {
            if (/(?:不得采用摇号|禁止摇号|严禁抓阄)/.test(sentence)) {
                return false;
            }
            return (
                /(?:摇号|抓阄|抽签|随机抽取).{0,18}(?:确定中标人|定标|确定第一中标候选人|确定中标候选人|方式中标|决定中标|选定)/.test(sentence) ||
                /(?:采用|通过|以)(?:摇号|抓阄|抽签)(?:的)?(?:方式)?(?:确定|选定)(?:中标|中选|入围)/.test(sentence)
            );
        },
    },
    {
        ruleId: 'selective_fiscal_subsidy',
        ruleName: '选择性财政奖补、税收返还或“一事一议”',
        lawHint: '《公平竞争审查条例》第十二条及《实施办法》禁止违法实施与企业税收、产值贡献挂钩的选择性财政奖补、税收返还或“一事一议”优惠',
        match: ({ sentence }) => {
            if (/(?:不得实施|严禁以税收贡献|禁止一事一议)/.test(sentence)) {
                return false;
            }
            return (
                /(?:本地纳统|迁入注册地|经济贡献|地方留存|税收留存|产值贡献).{0,20}(?:奖补|奖励|补贴|返还|扶持)/.test(sentence) ||
                /(?:财政奖补|财政补贴|税收返还|土地出让金返还|先征后返|即征即退|一事一议).{0,20}(?:协议|企业|落户|纳税|产值|贡献|返还|扶持|优惠)/.test(sentence) ||
                /采取[“"']?一事一议[”"']?(?:方式)?(?:给予|实施)?(?:奖补|扶持|优惠|补贴)/.test(sentence)
            );
        },
    },
];

interface SentenceSpan {
    text: string;
    start: number;
    end: number;
}

function splitSentencesWithOffsets(text: string): SentenceSpan[] {
    const spans: SentenceSpan[] = [];
    const lineRe = /[^\r\n]+/g;
    let lineMatch: RegExpExecArray | null;

    while ((lineMatch = lineRe.exec(text)) !== null) {
        const lineText = lineMatch[0];
        const lineStart = lineMatch.index;
        const trimmedLine = lineText.trim();
        if (!trimmedLine) continue;

        // 按句末标点切分；保留每个子句精确偏移
        const sentenceRe = /[^。！？；]+[。！？；]?/g;
        let sentMatch: RegExpExecArray | null;
        while ((sentMatch = sentenceRe.exec(lineText)) !== null) {
            const raw = sentMatch[0];
            const leadingWs = raw.length - raw.trimStart().length;
            const trimmed = raw.trim();
            if (trimmed.length < 4) continue;
            const start = lineStart + sentMatch.index + leadingWs;
            const end = start + trimmed.length;
            spans.push({ text: trimmed, start, end });
        }
    }

    return spans;
}

function extractCleanSnippet(fullText: string, start: number, end: number): string {
    const MIN_LEN = 60;
    const MAX_LEN = 160;
    const spanLen = end - start;

    let winStart = start;
    let winEnd = end;

    if (spanLen < MIN_LEN) {
        const needed = Math.ceil((MIN_LEN - spanLen) / 2) + 18;
        winStart = Math.max(0, start - needed);
        winEnd = Math.min(fullText.length, end + needed);
    } else if (spanLen > MAX_LEN) {
        winEnd = start + MAX_LEN;
    }

    // 尽量微调到不超出 MAX_LEN 且不少于 MIN_LEN
    if (winEnd - winStart < MIN_LEN && fullText.length >= MIN_LEN) {
        const deficit = MIN_LEN - (winEnd - winStart);
        const expandRight = Math.min(fullText.length - winEnd, deficit);
        winEnd += expandRight;
        const remaining = deficit - expandRight;
        if (remaining > 0) {
            winStart = Math.max(0, winStart - remaining);
        }
    }

    if (winEnd - winStart > MAX_LEN) {
        winEnd = winStart + MAX_LEN;
    }

    let snippet = fullText.slice(winStart, winEnd).replace(/\s+/g, ' ').trim();
    if (snippet.length > MAX_LEN) {
        snippet = snippet.slice(0, MAX_LEN).trim();
    }
    return snippet;
}

function normalizeForDedup(value: string): string {
    return value.replace(/[\s\u3000,.，。、;；:：!！?？"""''（）()【】\-_]/g, '').toLowerCase();
}

/**
 * 前置确定性特征扫描雷达：
 * 围绕《浙江省招标投标领域公平竞争审查细则》（21条）及《招标投标领域公平竞争审查规则》
 * 提取命中的疑似排斥限制竞争条款原文片段（同 ruleId 最多 3 条，总计最多 18 条）。
 */
export function scanDeterministicSignals(text: string, _category = ''): DeterministicSignal[] {
    if (!text || typeof text !== 'string') return [];

    const MAX_PER_RULE = 3;
    const MAX_TOTAL_SIGNALS = 18;
    const sentences = splitSentencesWithOffsets(text);
    const signals: DeterministicSignal[] = [];
    const ruleCounts = new Map<string, number>();
    const ruleSeenSnippets = new Map<string, Set<string>>();

    for (const span of sentences) {
        if (signals.length >= MAX_TOTAL_SIGNALS) break;

        for (const rule of DETERMINISTIC_RULES) {
            if (signals.length >= MAX_TOTAL_SIGNALS) break;
            const currentCount = ruleCounts.get(rule.ruleId) || 0;
            if (currentCount >= MAX_PER_RULE) continue;

            if (!rule.match({
                sentence: span.text,
                fullText: text,
                sentenceStart: span.start,
                sentenceEnd: span.end,
            })) {
                continue;
            }

            const snippet = extractCleanSnippet(text, span.start, span.end);
            const normKey = normalizeForDedup(snippet);
            if (!normKey) continue;

            let seenSet = ruleSeenSnippets.get(rule.ruleId);
            if (!seenSet) {
                seenSet = new Set<string>();
                ruleSeenSnippets.set(rule.ruleId, seenSet);
            }
            // 同 ruleId 去重：完全相同或互相大幅包含的片段跳过
            let isDup = false;
            for (const prev of seenSet) {
                if (prev === normKey || prev.includes(normKey) || normKey.includes(prev)) {
                    isDup = true;
                    break;
                }
            }
            if (isDup) continue;

            seenSet.add(normKey);
            ruleCounts.set(rule.ruleId, currentCount + 1);
            signals.push({
                ruleId: rule.ruleId,
                ruleName: rule.ruleName,
                snippet,
                lawHint: rule.lawHint,
            });
        }
    }

    return signals;
}

/**
 * 将前置确定性规则雷达扫描出的信号格式化为审查提示清单。
 */
export function formatDeterministicSignalsForPrompt(signals: DeterministicSignal[]): string {
    if (!signals || signals.length === 0) return '';

    const items = signals.map((s, idx) =>
        `${idx + 1}. 【${s.ruleName}】（${s.ruleId}）\n` +
        `   - 法规提示：${s.lawHint}\n` +
        `   - 定位原文片段：“${s.snippet}”`
    ).join('\n');

    return `
【前置确定性规则雷达命中清单（共 ${signals.length} 条高疑片段，务必逐条核查）】：
${items}

（雷达核查指令：上述片段由前置确定性规则雷达在全文中自动定位，请逐条结合上下文与【招投标法定合规白名单】复核：
1）确属排除、限制竞争的，必须各自独立输出一条 risk 对象（严禁合并或遗漏）；
2）确属法定合规白名单豁免或禁止性宣示的，排除不报；
3）除上述雷达定位外，仍须通读当前文本区块全文，找出雷达未覆盖的其他隐蔽违规条款。）
`.trim();
}

const BOILERPLATE_ENABLE_THRESHOLD = 35000;
const BOILERPLATE_MIN_SPAN = 5000;
const CHUNK_MAX = 46000;
const CHUNK_OVERLAP = 1500;
const MAX_AUDIT_CHUNKS = 3;
const SINGLE_CHUNK_DIRECT_LIMIT = 48000;

interface LineEntry {
    trimmed: string;
    start: number;
    end: number;
}

function getLineEntries(text: string): LineEntry[] {
    const lines: LineEntry[] = [];
    let pos = 0;
    const rawLines = text.split('\n');
    for (let i = 0; i < rawLines.length; i++) {
        const raw = rawLines[i];
        const start = pos;
        const end = pos + raw.length;
        lines.push({
            trimmed: raw.replace(/\r$/, '').trim(),
            start,
            end,
        });
        pos = end + 1; // +1 for '\n'
    }
    return lines;
}

function isTocLine(trimmed: string): boolean {
    return /(?:\.{3,}|…{2,}|·{3,})/.test(trimmed) || /\s+\d{1,4}$/.test(trimmed);
}

function isGeneralContractStartLine(trimmed: string): boolean {
    if (!trimmed || trimmed.length > 45 || isTocLine(trimmed)) return false;
    if (/(?:专用|前附表|评标|品牌|技术标准|工程量)/.test(trimmed)) return false;
    return /^(?:第[一二三四五六七八九十百\d]+(?:部分|节|章|篇)\s*|[（(]?[一二三四五六七八九十\d]+[）)、.]\s*)?通用合同条款(?:\s*[（(][^）)]{0,20}[）)])?$/.test(trimmed);
}

function isGeneralContractEndLine(trimmed: string): boolean {
    if (!trimmed || trimmed.length > 55 || isTocLine(trimmed)) return false;
    if (trimmed.includes('通用合同条款')) return false;
    if (/^第[一二三四五六七八九十百\d]+(?:部分|节|章|篇)\s+\S+/.test(trimmed)) {
        return true;
    }
    if (/^(?:专用合同条款|合同附件|发包人要求|工程量清单|技术标准和要求|技术标准|评标办法|采购需求|材料品牌表|设备品牌表)(?:\s*[（(][^）)]{0,20}[）)])?$/.test(trimmed)) {
        return true;
    }
    return false;
}

function dehydrateGeneralContractBoilerplate(text: string): {
    dehydratedText: string;
    removedBoilerplateChars: number;
} {
    if (text.length <= BOILERPLATE_ENABLE_THRESHOLD) {
        return { dehydratedText: text, removedBoilerplateChars: 0 };
    }

    const lines = getLineEntries(text);
    const replacements: Array<{ bodyStart: number; bodyEnd: number; removedChars: number }> = [];

    let i = 0;
    while (i < lines.length) {
        if (!isGeneralContractStartLine(lines[i].trimmed)) {
            i++;
            continue;
        }

        const bodyStart = lines[i].end + 1; // 保留开始标题行
        let endIdx = -1;
        for (let j = i + 1; j < lines.length; j++) {
            if (isGeneralContractEndLine(lines[j].trimmed)) {
                endIdx = j;
                break;
            }
        }

        if (endIdx < 0) {
            i++;
            continue;
        }

        const bodyEnd = lines[endIdx].start;
        const spanLen = bodyEnd - bodyStart;
        if (spanLen >= BOILERPLATE_MIN_SPAN) {
            const candidateBody = text.slice(bodyStart, bodyEnd);
            // 安全保护：严禁误删《专用合同条款》《投标人须知前附表》《评标办法》或推荐/材料品牌表
            const containsProtectedContent =
                /(?:投标人须知前附表|材料品牌表|设备品牌表|推荐品牌表|评标办法前附表)/.test(candidateBody);
            if (!containsProtectedContent) {
                replacements.push({ bodyStart, bodyEnd, removedChars: spanLen });
                i = endIdx;
                continue;
            }
        }
        i++;
    }

    if (replacements.length === 0) {
        return { dehydratedText: text, removedBoilerplateChars: 0 };
    }

    let result = '';
    let cursor = 0;
    let totalRemoved = 0;
    for (const rep of replacements) {
        result += text.slice(cursor, rep.bodyStart);
        result += `\n【系统注：此处已略去国家标准《通用合同条款》固定范本原文约 ${rep.removedChars} 字，后续《专用合同条款》及技术参数/品牌/评标要求已完整保留】\n`;
        totalRemoved += rep.removedChars;
        cursor = rep.bodyEnd;
    }
    result += text.slice(cursor);

    return {
        dehydratedText: result,
        removedBoilerplateChars: totalRemoved,
    };
}

function splitAuditChunks(dehydratedText: string): string[] {
    if (dehydratedText.length <= SINGLE_CHUNK_DIRECT_LIMIT) {
        return [dehydratedText];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < dehydratedText.length && chunks.length < MAX_AUDIT_CHUNKS) {
        const targetEnd = Math.min(start + CHUNK_MAX, dehydratedText.length);
        let end = targetEnd;

        if (targetEnd < dehydratedText.length) {
            const searchWindowStart = Math.max(start + Math.floor(CHUNK_MAX * 0.7), targetEnd - 1500);
            const slice = dehydratedText.slice(searchWindowStart, targetEnd);
            const lastNewline = slice.lastIndexOf('\n');
            if (lastNewline >= 0) {
                end = searchWindowStart + lastNewline + 1;
            } else {
                const lastPeriod = slice.lastIndexOf('。');
                if (lastPeriod >= 0) {
                    end = searchWindowStart + lastPeriod + 1;
                }
            }
        }

        // 若已是最后一块上限且距离末尾还有少量尾部文本（<= 2500 字）未覆盖，宁可略延到文末也不丢尾巴？
        // 这里严格遵守 CHUNK_MAX <= 46000（3块可覆盖 46000 + 2*(46000-1500) = 135000 字）
        chunks.push(dehydratedText.slice(start, end));

        if (end >= dehydratedText.length) {
            break;
        }

        let nextStart = Math.max(start + 1, end - CHUNK_OVERLAP);
        // 尽量在重叠起点附近对齐到行首，保证句子完整
        const alignSlice = dehydratedText.slice(nextStart, Math.min(end, nextStart + 200));
        const alignNl = alignSlice.indexOf('\n');
        if (alignNl >= 0 && nextStart + alignNl + 1 < end) {
            nextStart = nextStart + alignNl + 1;
        }
        start = nextStart;
    }

    return chunks;
}

function buildSummaryForGuidance(dehydratedText: string, signals: DeterministicSignal[]): string {
    const MAX_TOTAL = 4500;
    const HEAD_MAX = 1500;
    const EVALUATION_MAX = 1200;
    const SIGNALS_MAX = 1800;

    if (dehydratedText.length <= MAX_TOTAL && signals.length === 0) {
        return dehydratedText;
    }

    const head = dehydratedText.slice(0, HEAD_MAX);

    // 尽量避开开头目录，优先在 1200 字后找“评标办法/评分标准/投标人须知前附表”等核心实质章节
    let evalSection = '';
    const evalSearchRe = /(?:^|\n)[^\n]{0,15}(?:投标人须知前附表|评标办法前附表|评标办法|评分标准|评分细则|资格审查标准|材料品牌表)[^\n]*/g;
    let evalMatch: RegExpExecArray | null;
    let chosenIdx = -1;
    while ((evalMatch = evalSearchRe.exec(dehydratedText)) !== null) {
        const lineText = evalMatch[0].trim();
        if (isTocLine(lineText)) continue;
        if (evalMatch.index >= HEAD_MAX) {
            chosenIdx = evalMatch.index;
            break;
        }
        if (chosenIdx < 0 && evalMatch.index >= 300) {
            chosenIdx = evalMatch.index;
        }
    }
    if (chosenIdx >= 0) {
        evalSection = dehydratedText.slice(chosenIdx, chosenIdx + EVALUATION_MAX).trim();
    }

    let signalsBlock = '';
    if (signals.length > 0) {
        const lines: string[] = [];
        let accLen = 0;
        for (const sig of signals) {
            const line = `- [${sig.ruleName}] ${sig.snippet}`;
            if (accLen + line.length + 1 > SIGNALS_MAX) break;
            lines.push(line);
            accLen += line.length + 1;
        }
        if (lines.length > 0) {
            signalsBlock = `【全篇规则雷达命中高疑片段】：\n${lines.join('\n')}`;
        }
    }

    const parts: string[] = [`【文件开头概况与资格要求】：\n${head}`];
    if (evalSection) {
        parts.push(`【评标/前附表/品牌关键章节摘录】：\n${evalSection}`);
    }
    if (signalsBlock) {
        parts.push(signalsBlock);
    }

    let combined = parts.join('\n\n');
    if (combined.length > MAX_TOTAL) {
        combined = combined.slice(0, MAX_TOTAL);
    }
    return combined;
}

/**
 * 长标书智能脱水、前置规则雷达扫描与多块完整覆盖切片预处理。
 */
export function prepareDocumentForAudit(text: string, category = ''): PreparedAuditDocument {
    const safeText = typeof text === 'string' ? text : '';
    const { dehydratedText, removedBoilerplateChars } = dehydrateGeneralContractBoilerplate(safeText);
    const signals = scanDeterministicSignals(dehydratedText, category);
    const auditChunks = splitAuditChunks(dehydratedText);
    const summaryForGuidance = buildSummaryForGuidance(dehydratedText, signals);

    return {
        dehydratedText,
        auditChunks,
        summaryForGuidance,
        removedBoilerplateChars,
        signals,
    };
}
