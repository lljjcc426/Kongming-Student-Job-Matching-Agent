const assert = require("node:assert/strict");

const response = (payload) => ({ ok: true, status: 200, json: async () => payload });
const htmlResponse = (html) => ({ ok: true, status: 200, text: async () => html });

async function main() {
  const { collectMokaJobs } = await import("../server/jobs/adapters/moka.js");
  const { collectByteDanceJobs } = await import("../server/jobs/adapters/bytedance.js");
  const { collectBaiduJobs, parseBaiduInitialData } = await import("../server/jobs/adapters/baidu.js");
  const { collectGreenhouseJobs } = await import("../server/jobs/adapters/greenhouse.js");
  const { collectLeverJobs } = await import("../server/jobs/adapters/lever.js");
  const { collectAshbyJobs } = await import("../server/jobs/adapters/ashby.js");
  const { parseJsonLdJob } = await import("../server/jobs/adapters/searchDiscovery.js");
  const { isChinaMarketJob, queryJobs, resetJobRepositoryForTests, upsertJobs } = await import("../server/jobs/jobRepository.js");
  const { inferEmploymentType, inferKeywords, inferLevel, jobSearchQueries } = await import("../server/jobs/utils.js");

  resetJobRepositoryForTests();
  const common = { query: "前端 TypeScript", city: "上海", limit: 10 };
  const moka = await collectMokaJobs({
    ...common,
    source: {
      id: "moka-test",
      company: "测试科技",
      sourceType: "official-ats",
      market: "cn",
      employerPriority: 50,
      orgId: "test",
      mode: "campus",
      careersUrl: "https://app.mokahr.com/campus-recruitment/test/1",
      domains: ["app.mokahr.com"],
    },
    fetchImpl: async () => response({
      jobs: [{
        id: "moka-1",
        title: "前端开发实习生",
        status: "open",
        description: "<p>岗位职责</p><p>使用 React 与 TypeScript 开发产品。</p>",
        commitment: "实习",
        education: "本科",
        publishedAt: "2026-07-20T00:00:00Z",
        updatedAt: "2026-07-20T01:00:00Z",
        locations: [{ province: "上海市", area: "浦东新区" }],
        department: { name: "研发部" },
      }],
    }),
  });
  assert.equal(moka.length, 1);
  assert.equal(moka[0].employmentType, "intern");
  assert.equal(moka[0].verification, "official-ats");
  assert.match(moka[0].sourceUrl, /#\/job\/moka-1$/);

  let byteDanceSearchHeaders = null;
  const bytedance = await collectByteDanceJobs({
    ...common,
    source: {
      id: "bytedance-test",
      company: "字节跳动",
      sourceType: "official-api",
      market: "cn",
      employerPriority: 100,
      domains: ["jobs.bytedance.com"],
    },
    fetchImpl: async (url, options) => {
      if (String(url).includes("/api/v1/csrf/token")) {
        assert.equal(options.method, "POST");
        return response({ code: 0, data: { token: "csrf-token" } });
      }
      byteDanceSearchHeaders = options.headers;
      assert.equal(options.method, "POST");
      assert.match(String(url), /\/api\/v1\/search\/job\/posts/);
      return response({
        code: 0,
        data: {
          job_post_list: [{
            id: "byte-1",
            title: "前端开发工程师",
            description: "负责 React 与 TypeScript 产品开发。",
            requirement: "本科及以上学历，具备前端工程经验。",
            city_list: [{ name: "深圳" }],
            job_category: { name: "技术" },
            recruit_type: { name: "正式" },
            publish_time: 1784505600000,
          }],
        },
      });
    },
  });
  assert.equal(bytedance.length, 1);
  assert.equal(bytedance[0].company, "字节跳动");
  assert.equal(bytedance[0].city, "深圳");
  assert.equal(bytedance[0].verification, "official-live-api");
  assert.match(bytedance[0].sourceUrl, /\/experienced\/position\/byte-1\/detail$/);
  assert.equal(byteDanceSearchHeaders["x-csrf-token"], "csrf-token");

  const baiduPayload = {
    detailData: { projectType: undefined },
    listData: {
      recruitType: "GRADUATE",
      listDetailData: [{
        postId: "baidu-1",
        jobId: "baidu-job-1",
        name: "上海-产品经理(J100001)",
        postType: "产品",
        workPlace: "上海市",
        workContent: "负责产品规划、需求分析与数据验证。",
        serviceCondition: "本科及以上学历，具备良好沟通能力。",
        publishDate: "2026-07-08",
        updateDate: "2026-07-21",
      }],
    },
  };
  const baiduHtml = `<script>window.__INITIAL_DATA__ =${JSON.stringify(baiduPayload)}; window.prefix="/jobs";undefined</script>`;
  assert.equal(parseBaiduInitialData(baiduHtml).listData.listDetailData.length, 1);
  let baiduAttempts = 0;
  const baidu = await collectBaiduJobs({
    ...common,
    source: {
      id: "baidu-test",
      company: "百度",
      sourceType: "official-page",
      market: "cn",
      employerPriority: 100,
      mode: "social",
      domains: ["talent.baidu.com"],
    },
    fetchImpl: async () => {
      baiduAttempts += 1;
      return baiduAttempts === 1 ? { ok: false, status: 503 } : htmlResponse(baiduHtml);
    },
  });
  assert.equal(baiduAttempts, 2);
  assert.equal(baidu.length, 1);
  assert.equal(baidu[0].company, "百度");
  assert.equal(baidu[0].level, "校招");
  assert.equal(baidu[0].verification, "official-server-rendered");
  assert.match(baidu[0].sourceUrl, /\/jobs\/detail\/GRADUATE\/baidu-1$/);

  const greenhouse = await collectGreenhouseJobs({
    ...common,
    source: { id: "greenhouse-test", company: "Figma", sourceType: "official-ats", market: "global", employerPriority: 0, boardToken: "figma", domains: ["boards.greenhouse.io"] },
    fetchImpl: async () => response({ jobs: [{
      id: 2,
      title: "Frontend Engineer",
      company_name: "Figma",
      location: { name: "London" },
      content: "<p>Build React products with TypeScript.</p>",
      absolute_url: "https://boards.greenhouse.io/figma/jobs/2",
      first_published: "2026-07-19T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
    }] }),
  });
  assert.equal(greenhouse[0].company, "Figma");
  assert.ok(greenhouse[0].keywords.includes("TypeScript"));

  const lever = await collectLeverJobs({
    ...common,
    source: { id: "lever-test", company: "Palantir", sourceType: "official-ats", market: "global", employerPriority: 0, site: "palantir", domains: ["jobs.lever.co"] },
    fetchImpl: async () => response([{
      id: "lever-3",
      text: "Product Engineer",
      categories: { location: "New York", team: "Engineering", commitment: "Full-time" },
      descriptionPlain: "Build data products.",
      lists: [],
      hostedUrl: "https://jobs.lever.co/palantir/lever-3",
      applyUrl: "https://jobs.lever.co/palantir/lever-3/apply",
      createdAt: 1784505600000,
    }]),
  });
  assert.equal(lever[0].employmentType, "full-time");
  assert.match(lever[0].applyUrl, /apply$/);

  const ashby = await collectAshbyJobs({
    ...common,
    source: { id: "ashby-test", company: "Linear", sourceType: "official-ats", market: "global", employerPriority: 0, boardName: "linear", domains: ["jobs.ashbyhq.com"] },
    fetchImpl: async () => response({ jobs: [{
      id: "ashby-4",
      title: "Software Engineer",
      department: "Product",
      team: "Engineering",
      employmentType: "FullTime",
      location: "Remote",
      isListed: true,
      descriptionPlain: "Build a TypeScript application.",
      jobUrl: "https://jobs.ashbyhq.com/linear/ashby-4",
      applyUrl: "https://jobs.ashbyhq.com/linear/ashby-4/application",
      publishedAt: "2026-07-20T00:00:00Z",
    }] }),
  });
  assert.equal(ashby[0].city, "Remote");
  assert.equal(ashby[0].department, "Product / Engineering");
  assert.equal(moka[0].market, "cn");
  assert.equal(greenhouse[0].market, "global");
  assert.equal(isChinaMarketJob(moka[0]), true);
  assert.equal(isChinaMarketJob(greenhouse[0]), false);
  assert.equal(isChinaMarketJob({ market: "cn", company: "腾讯", city: "迪拜" }), false);
  assert.equal(isChinaMarketJob({ market: "cn", company: "字节跳动", city: "Dubai, UAE" }), false);
  assert.equal(isChinaMarketJob({ market: "cn", company: "腾讯", city: "帕罗奥多" }), false);
  assert.equal(isChinaMarketJob({ market: "cn", company: "腾讯", city: "阿姆斯特丹" }), false);
  assert.equal(isChinaMarketJob({ market: "cn", company: "腾讯", city: "沈阳" }), true);
  assert.equal(isChinaMarketJob({ market: "cn", company: "腾讯", city: "地点见原岗位页" }), true);
  assert.equal(inferLevel("Build a better Internet for everyone"), "社招");
  assert.equal(inferEmploymentType("Build a better Internet for everyone"), "full-time");
  assert.equal(inferKeywords("安全分析岗位", "前端开发实习生").includes("前端开发实习生"), false);
  assert.deepEqual(jobSearchQueries("算法实习生 / AI 应用工程师实习生"), ["算法", "AI 应用"]);
  assert.deepEqual(jobSearchQueries("前端开发工程师"), ["前端"]);

  const jsonLd = parseJsonLdJob(`<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: "算法工程师",
    datePosted: "2026-07-20",
  })}</script>`);
  assert.equal(jsonLd.title, "算法工程师");

  await upsertJobs([...moka, ...bytedance, ...baidu, ...greenhouse, ...lever, ...ashby]);
  const chinaMarket = await queryJobs({ market: "cn", limit: 10 });
  assert.deepEqual(new Set(chinaMarket.jobs.map((job) => job.company)), new Set(["测试科技", "字节跳动", "百度"]));
  const internshipSearch = await queryJobs({ query: "前端开发实习生", limit: 10 });
  assert.deepEqual(internshipSearch.jobs.map((job) => job.id), moka.map((job) => job.id));
  const firstPage = await queryJobs({ limit: 2 });
  assert.equal(firstPage.total, 6);
  assert.equal(firstPage.jobs.length, 2);
  assert.ok(firstPage.nextCursor);
  const secondPage = await queryJobs({ limit: 2, cursor: firstPage.nextCursor });
  assert.equal(secondPage.jobs.length, 2);
  console.log("job source adapters verification passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
