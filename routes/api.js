'use strict';
const StockModel = require("../models").Stock;
const fetch = require('node-fetch');

async function createStock(stock, like, ip) {
  const newStock = new StockModel({
    symbol: stock,
    likes: like ? [ip] : [],
  });
  const savedNew = await newStock.save();
  return savedNew;
}

async function findStock(stock) {
  return await StockModel.findOne({ symbol: stock }).exec();
}

async function saveStock(stock, like, ip) {
  let saved = {};
  const foundStock = await findStock(stock);
  if (!foundStock) {
    const createsaved = await createStock(stock, like, ip);
    saved = createsaved;
    return saved;
  } else {
    if (like && foundStock.likes.indexOf(ip) === -1) {
      foundStock.likes.push(ip);
    }
    saved = await foundStock.save();
    return saved;
  }
}

async function getStock(stock) {
  const response = await fetch(
    `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stock}/quote`
  );
  const { symbol, latestPrice } = await response.json();
  return { symbol, latestPrice };
}

module.exports = function (app) {
  app.route('/api/stock-prices').get(async function (req, res) {
    const { stock, like } = req.query;

    if (typeof stock === 'string') {
      const { symbol, latestPrice } = await getStock(stock);

      if (!symbol) {
        res.json({ stockData: { likes: like ? 1 : 0 } });
        return;
      }

      const stockData = await saveStock(symbol, like, req.ip);

      res.json({
        stockData: {
          stock: symbol,
          price: latestPrice,
          likes: stockData.likes.length,
        },
      });
    } else if (Array.isArray(stock) && stock.length === 2) {
      const [stock1, stock2] = stock;
      const [data1, data2] = await Promise.all([
        getStock(stock1),
        getStock(stock2),
      ]);

      if (!data1.symbol || !data2.symbol) {
        res.json({ error: 'One or both stocks are not found' });
        return;
      }

      const [stockData1, stockData2] = await Promise.all([
        saveStock(data1.symbol, like, req.ip),
        saveStock(data2.symbol, like, req.ip),
      ]);

      res.json({
        stockData: [
          {
            stock: data1.symbol,
            price: data1.latestPrice,
            rel_likes: stockData1.likes.length - stockData2.likes.length,
          },
          {
            stock: data2.symbol,
            price: data2.latestPrice,
            rel_likes: stockData2.likes.length - stockData1.likes.length,
          },
        ],
      });
    } else {
      res.json({ error: 'Invalid request' });
    }
  });
};
