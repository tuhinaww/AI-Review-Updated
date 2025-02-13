require("dotenv").config();
const axios = require("axios");
const { CohereClientV2 } = require("cohere-ai");

const { MY_GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER } = process.env;

const githubApi = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Authorization: `Bearer ${MY_GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
  },
});

const postComment = async (owner, repo, pullNumber, file, summary) => {
  try {
    const response = await githubApi.post(`/repos/${owner}/${repo}/issues/${pullNumber}/comments`, {
      body: `### Summary of changes in ${file}:\n\n${summary}`,
    });

    console.log(`Comment posted for ${file}: ${response.data.html_url}`);
  } catch (error) {
    console.error(`Error posting comment for ${file}:`, error.response?.data || error.message);
  }
};

const cohere = new CohereClientV2({
  token: process.env.COHERE_API_KEY,
});


const getPullRequestDiff = async (owner, repo, pullNumber) => {
  try {
    const response = await githubApi.get(`/repos/${owner}/${repo}/pulls/${pullNumber}`, {
      headers: { Accept: "application/vnd.github.v3.diff" },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching PR diff:", error.response?.data || error.message);
    throw new Error("Failed to fetch PR diff");
  }
};


const getPullRequestFiles = async (owner, repo, pullNumber) => {
  try {
    const response = await githubApi.get(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`);
    return response.data.map(file => file.filename);
  } catch (error) {
    console.error("Error fetching PR files:", error.response?.data || error.message);
    throw new Error("Failed to fetch PR files");
  }
};


const getPullRequestDiffForFile = async (owner, repo, pullNumber, file) => {
  try {
    const response = await githubApi.get(`/repos/${owner}/${repo}/pulls/${pullNumber}`, {
      headers: { Accept: "application/vnd.github.v3.diff" },
    });

    const diffs = response.data.split("diff --git");
    const fileDiff = diffs.find(part => part.includes(` a/${file} `) || part.includes(` b/${file} `));

    return fileDiff ? `diff --git${fileDiff}` : null;
  } catch (error) {
    console.error(`Error fetching diff for file ${file}:`, error.response?.data || error.message);
    throw new Error(`Failed to fetch diff for ${file}`);
  }
};

const getDiffSummary = async (diff, file) => {
    if (!diff) return `No significant changes detected in ${file}.`;
  
    try {
      const response = await cohere.generate({
        model: "command",
        prompt: `Summarize & Review these code changes in following file. Identify issues, optimizations, and best practices. Provide concise, actionable feedback, In bullet points. ${file}\n\n${diff}`,
        max_tokens: 150,
      });
  
      return response.generations[0].text.trim();
    } catch (error) {
      console.error(`Error summarizing diff for ${file}:`, error.response?.data || error.message);
      return `Could not generate a summary for ${file}.`;
    }
  };

const run = async () => {
  const [owner, repo] = GITHUB_REPOSITORY.split("/");

  try {
    const files = await getPullRequestFiles(owner, repo, PR_NUMBER);

    for (const file of files) {
      const diff = await getPullRequestDiffForFile(owner, repo, PR_NUMBER, file);
      const summary = await getDiffSummary(diff, file);
      await postComment(owner, repo, PR_NUMBER, file, summary);
    }
  } catch (error) {
    console.error("Error processing PR:", error);
    process.exit(1);
  }
};

run();
