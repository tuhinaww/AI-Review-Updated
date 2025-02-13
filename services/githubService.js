const axios = require("axios");
const { CohereClientV2 } = require("cohere-ai");

const githubApi = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Authorization: `Bearer ${process.env.MY_GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
  },
});

console.log(process.env.MY_GITHUB_TOKEN);

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
        prompt: `Summarize & Review these code changes in following file. Identify issues, optimizations, and best practices. Provide concise, actionable feedback, In bullet points and 80-100 words. ${file}\n\n${diff}`,
        max_tokens: 150,
      });
  
      return response.generations[0].text.trim();
    } catch (error) {
      console.error(`Error summarizing diff for ${file}:`, error.response?.data || error.message);
      return `Could not generate a summary for ${file}.`;
    }
  };
  
  module.exports = { getPullRequestDiff, getDiffSummary, getPullRequestFiles, getPullRequestDiffForFile };
