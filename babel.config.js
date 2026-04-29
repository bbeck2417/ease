module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Remove the "nativewind/babel" line from here if you have one
  };
};
