import { plugin } from "bun";

console.log("PRELOAD RUNNING");

plugin({
  name: "react-native-mock-plugin",
  setup(build) {
    console.log("SETUP RUNNING");
    build.onResolve({ filter: /^react-native$/ }, (args) => {
      console.log("RESOLVING react-native", args);
      return { path: import.meta.resolve("./react-native-mock.ts") };
    });
    build.onResolve({ filter: /^expo-sqlite$/ }, (args) => {
      console.log("RESOLVING expo-sqlite", args);
      return { path: import.meta.resolve("./expo-sqlite-mock.ts") };
    });
  },
});
