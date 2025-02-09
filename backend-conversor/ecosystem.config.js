module.exports = {
    apps: [
      {
        name: "app",
        script: "./index.js",
        watch: false
      },
      {
        name: "worker",
        script: "./worker.js",
        watch: false
      }
    ]
  };
  