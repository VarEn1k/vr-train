const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  plugins: [
    new HtmlWebpackPlugin({
      title: 'VR Train',
      favicon: './assets/logo.png'
    }),
    new CopyWebpackPlugin({
      patterns: [
        {from: 'node_modules/three/examples/jsm/libs/draco', to: 'draco'}
      ]
    }),
    new CopyWebpackPlugin({
      patterns: [
        {from: 'node_modules/@webxr-input-profiles/assets/dist/profiles', to: 'profiles'}
      ]
    })
  ],
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|glb|ogg|mp3|hdr)$/i,
        type: 'asset/resource',
      },
    ]
  },
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist2/docs'),
    clean: true
  },
  devServer: {
    // static: {
    //   directory: path.join(__dirname, 'src/logo.png')
    // },
    compress: true,
    port: 8080
  }
};
