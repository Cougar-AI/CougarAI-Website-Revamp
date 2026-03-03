module.exports = {
  apps: [
    {
      name: "cai-website-api",
      script: "run.py",
      interpreter: "/home/cai/CAI_Website/.venv/bin/python",
      cwd: "/home/cai/CAI_Website/CougarAI-Website-Revamp/backend",
      instances: 1,
      exec_mode: "fork",
      env: {
        FLASK_ENV: "Development"
      },
      error_file: "/tmp/pm2-cai-website-api-error.log",
      out_file: "/tmp/pm2-cai-website-api-output.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};
