const assert = require("node:assert/strict");

const rss = `<?xml version="1.0"?><rss><channel><item>
  <title><![CDATA[产品经理实习生 - 字节跳动校园招聘]]></title>
  <link>https://jobs.bytedance.com/campus/position/123?utm_source=test</link>
  <description><![CDATA[北京 产品设计、需求分析与数据分析，面向应届生和实习生。]]></description>
  <pubDate>Fri, 17 Jul 2026 08:00:00 GMT</pubDate>
</item></channel></rss>`;

async function main() {
  const { collectPublicJobs } = await import("../server/jobCollector.js");
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
            Count: 1,
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
  assert.equal(official.jobs[0].company, "腾讯");
  assert.equal(official.jobs[0].verification, "official-live-api");
  assert.equal(official.jobs[0].publishedAt, "2026-07-16T16:00:00.000Z");
  assert.equal(official.jobs[0].sourceUrl.startsWith("https://careers.tencent.com/"), true);
  console.log("job collector verification passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
