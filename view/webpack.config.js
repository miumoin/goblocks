const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
  
    // Load environment variables from .env file
    require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

    return {
        entry: './src/index.tsx',
        output: {
            path: path.resolve(__dirname, 'dist/static'),
            filename: 'bundle.[contenthash].js',
            publicPath: '/static/',
            clean: true,
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
            alias: {
                '@': path.resolve(__dirname, 'src'),
            },
        },
        module: {
            rules: [
                {
                    test: /\.(ts|tsx)$/,
                    exclude: /node_modules/,
                    use: 'ts-loader',
                },
                {
                    test: /\.css$/,
                    use: [
                        isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
                        'css-loader'
                    ],
                },
                {
                    test: /\.(png|svg|jpg|jpeg|gif)$/i,
                    type: 'asset/resource',
                },
            ],
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: './public/index.html',
                favicon: './public/favicon.ico',
                meta: {
                    viewport: 'width=device-width, initial-scale=1',
                    description: 'ShopifyGO Quote Offer App',
                    'shopify-api-key': process.env.SHOPIFY_API_KEY || '',
                    'shopify-api-scopes': process.env.SHOPIFY_API_SCOPES || '',
                },
                google_client_id: process.env.GOOGLE_CLIENT_ID || '',
            }),
            new MiniCssExtractPlugin({
                filename: 'css/[name].[contenthash].css'
            })
        ],
        devServer: {
            static: {
                directory: path.join(__dirname, 'public'),
            },
            compress: true,
            port: 3000,
            historyApiFallback: true,
            proxy: [
                {
                    context: ['/api'],
                    target: 'http://localhost:8050',
                    secure: false,
                    changeOrigin: true,
                }
            ],
        },
        devtool: isProduction ? 'source-map' : 'eval-source-map',
        performance: {
            hints: isProduction ? 'warning' : false,
            maxEntrypointSize: 512000,
            maxAssetSize: 512000,
        },
    };
};