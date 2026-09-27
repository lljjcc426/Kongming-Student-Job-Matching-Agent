const assert = require("node:assert/strict");

const rss = `<?xml version="1.0"?><rss><channel><item>
  <title><![CDATA[产品经理实习生 - 字节跳动校园招聘]]></title>
  <link>https://jobs.bytedance.com/campus/position/123?utm_source=test</link>
  <description><![CDATA[北京 产品设计、需求分析与数据分析，面向应届生和实习生。]]></description>
  <pubDate>Fri, 17 Jul 2026 08:00:00 GMT</pubDate>
</item></channel></rss>`;

async function main() {
  const { collectPublicJobs, resetJobCollectorCacheForTests } = await import("../server/jobCollector.js");
  const { resetJobRepositoryForTests } = await import("../server/jobs/jobRepository.js");
  const fakeFetch = async (url) => {
    if (String(url).includes("tencentcareer/api/post/Query")) {
      return { ok: true, status: 200, json: async () => ({ Code: 200, Data: { Count: 0, Posts: [] } }) };
    }
    if (String(url).includes("format=rss")) {
      return { ok: true, status: 200, text: async () => rss };
    }
    return { ok: true, status: 200, text: async () => "" };
  };
  const result = await collectPublicJobs({ query: "字节跳动 产品", city: "北京", limit: 5, fetchImpl: fakeFetch });
  assert.equal(result.ok, true);
  assert.equal(result.live, true);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].company, "字节跳动");
  assert.equal(result.jobs[0].level, "实习");
  assert.equal(result.jobs[0].city, "北京");
  assert.equal(result.jobs[0].verification, "official-reachable");
  assert.equal(result.jobs[0].sourceUrl.includes("utm_source"), false);
  assert.ok(result.jobs[0].keywords.includes("产品设计"));

  const tencentFetch = async (url) => {
    if (String(url).includes("tencentcareer/api/post/Query")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          Code: 200,
          Data: {
            Count: 3,
            Posts: [{
              PostId: "20260717",
              RecruitPostName: "前端开发工程师",
              LocationName: "深圳",
              CategoryName: "技术",
              ProductName: "在线业务",
              Responsibility: "负责 React、TypeScript 与 Node.js 产品开发和数据分析。",
              LastUpdateTime: "2026年07月17日",
              PostURL: "http://careers.tencent.com/jobdesc.html?postId=20260717",
              IsValid: true,
              RequireWorkYearsName: "一年以上工作经验",
            }, {
              PostId: "20260718",
              RecruitPostName: "前端开发工程师-日本",
              LocationName: "東京 Japan",
              CategoryName: "技术",
              ProductName: "海外业务",
              Responsibility: "负责 React、TypeScript 产品开发。",
              LastUpdateTime: "2026年07月18日",
              PostURL: "https://careers.tencent.com/jobdesc.html?postId=20260718",
              IsValid: true,
            }, {
              PostId: "20260719",
              RecruitPostName: "Sales Intern, Cloud & AI",
              LocationName: "迪拜",
              CategoryName: "销售",
              ProductName: "云与智慧产业",
              Responsibility: "负责中东区域云产品销售支持。",
              LastUpdateTime: "2026年07月19日",
              PostURL: "https://careers.tencent.com/jobdesc.html?postId=20260719",
              IsValid: true,
            }],
          },
        }),
      };
    }
    if (String(url).includes("format=rss")) return { ok: true, status: 200, text: async () => "<rss><channel></channel></rss>" };
    return { ok: true, status: 200, text: async () => "" };
  };
  const official = await collectPublicJobs({ query: "前端开发", city: "深圳", limit: 5, fetchImpl: tencentFetch });
  assert.equal(official.jobs.length, 1);
  assert.equal(official.market, "cn");
  assert.equal(official.jobs[0].company, "腾讯");
  assert.equal(official.jobs.some((job) => /東京|Japan|迪拜|Dubai|UAE/i.test(job.city)), false);
  assert.equal(official.jobs[0].verification, "official-live-api");
  assert.equal(official.jobs[0].publishedAt, "2026-07-16T16:00:00.000Z");
  assert.equal(official.jobs[0].sourceUrl.startsWith("https://careers.tencent.com/"), true);

  resetJobCollectorCacheForTests();
  resetJobRepositoryForTests();
  const recoveryQuery = "离线恢复前端";
  await assert.rejects(
    collectPublicJobs({
      query: recoveryQuery,
      city: "深圳",
      company: "腾讯",
      limit: 5,
      fetchImpl: async () => { throw new Error("network offline"); },
    }),
    /All job sources are unavailable/,
  );
  const recovered = await collectPublicJobs({
    query: recoveryQuery,
    city: "深圳",
    company: "腾讯",
    limit: 5,
    fetchImpl: tencentFetch,
  });
  assert.equal(recovered.jobs.length, 1);
  assert.equal(recovered.jobs[0].company, "腾讯");
  console.log("job collector verification passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
