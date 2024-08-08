module.exports = {
    target: "web",
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
            },
            {
                test: /\.js$/,
                use: 'babel-loader',
            }
        ],
    },
};
