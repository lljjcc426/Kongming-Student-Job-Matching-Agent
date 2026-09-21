const assert = require("node:assert/strict");

const response = (payload) => ({ ok: true, status: 200, json: async () => payload });

async function main() {
  const { collectMokaJobs } = await import("../server/jobs/adapters/moka.js");
  const { collectGreenhouseJobs } = await import("../server/jobs/adapters/greenhouse.js");
  const { collectLeverJobs } = await import("../server/jobs/adapters/lever.js");
  const { collectAshbyJobs } = await import("../server/jobs/adapters/ashby.js");
  const { parseJsonLdJob } = await import("../server/jobs/adapters/searchDiscovery.js");
  const { queryJobs, resetJobRepositoryForTests, upsertJobs } = await import("../server/jobs/jobRepository.js");
  const { inferEmploymentType, inferKeywords, inferLevel } = await import("../server/jobs/utils.js");

  resetJobRepositoryForTests();
  const common = { query: "前端 TypeScript", city: "上海", limit: 10 };
  const moka = await collectMokaJobs({
    ...common,
    source: {
      id: "moka-test",
      company: "测试科技",
      sourceType: "official-ats",
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

  const greenhouse = await collectGreenhouseJobs({
    ...common,
    source: { id: "greenhouse-test", company: "Figma", sourceType: "official-ats", boardToken: "figma", domains: ["boards.greenhouse.io"] },
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
    source: { id: "lever-test", company: "Palantir", sourceType: "official-ats", site: "palantir", domains: ["jobs.lever.co"] },
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
    source: { id: "ashby-test", company: "Linear", sourceType: "official-ats", boardName: "linear", domains: ["jobs.ashbyhq.com"] },
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
  assert.equal(inferLevel("Build a better Internet for everyone"), "社招");
  assert.equal(inferEmploymentType("Build a better Internet for everyone"), "full-time");
  assert.equal(inferKeywords("安全分析岗位", "前端开发实习生").includes("前端开发实习生"), false);

  const jsonLd = parseJsonLdJob(`<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: "算法工程师",
    datePosted: "2026-07-20",
  })}</script>`);
  assert.equal(jsonLd.title, "算法工程师");

  await upsertJobs([...moka, ...greenhouse, ...lever, ...ashby]);
  const internshipSearch = await queryJobs({ query: "前端开发实习生", limit: 10 });
  assert.deepEqual(internshipSearch.jobs.map((job) => job.id), moka.map((job) => job.id));
  const firstPage = await queryJobs({ limit: 2 });
  assert.equal(firstPage.total, 4);
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
