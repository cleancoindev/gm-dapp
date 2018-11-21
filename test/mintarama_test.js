var solc = require('solc');
var Web3 = require('web3');
var expect = require('chai').expect;

var fs = require('fs');
var assert = require('assert');
var BigNumber = require('bignumber.js');
var realMath = require('./helpers/real_math.js');

var web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE));

var accounts = new Array();
var creator;
var buyer1;
var buyer2;
var buyer3;
var buyer4;
var buyer5;
var buyer6;


var mntContractAddress;
var mntContract;

var commonDataContractAddress;
var commonDataContract;

var mraContractAddress;
var mraContract;

var mraContractAddressOld;
var mraContractOld;

var dataContractAddress = 0x0;

var ether = 1000000000000000000;
var initTotalTokenSupply = 0;
var shareFeePercent = 0;    
var refFeePercent = 0;  
var devRewardPercent = 0;  
var priceSpeed = 0; 
var startTokenPrice = 0;
var totalTokenBalance = 0;
var bigPromoInterval = 0;
var quickPromoInterval = 0;
var promoMinPurchaseEth = 0;
var blockNum = 0;
var minRefTokenAmount = 0;
var initTokenAmount = 0;

function addAccount(pk, name) {
    accounts.push({pubKey: pk, name: name, initTokenBalance: new BigNumber(0)})
}

function addAccountInitBalance(pk, balance) {
    accounts.forEach(a => {
        if (a.pubKey != pk) return;

        a.initTokenBalance = a.initTokenBalance.add(balance);
    });
}

function bignumToFloat(bignum) {
    return parseFloat(bignum.div(1e18).toString(10));
}

function updateTokenBalance(tokenAmount) {
    totalTokenBalance += bignumToFloat(tokenAmount);
}

function getExpectedTokenPrice() {
    return (startTokenPrice * Math.exp(totalTokenBalance * priceSpeed));
}

async function getCurrentTokenPrice() {
    return bignumToFloat(await mraContract.getCurrentTokenPrice());
}

async function updateBlockNum()
{
    blockNum = await mraContract.getBlockNumSinceInit({from: buyer1});
}

function getEtalonPrice(tokenAmount) {
    return startTokenPrice * Math.exp(bignumToFloat(tokenAmount) * priceSpeed / 2);
}

function toFixed(x) {
    if (Math.abs(x) < 1.0) {
      var e = parseInt(x.toString().split('e-')[1]);
      if (e) {
          x *= Math.pow(10,e-1);
          x = '0.' + (new Array(e)).join('0') + x.toString().substring(2);
      }
    } else {
      var e = parseInt(x.toString().split('+')[1]);
      if (e > 20) {
          e -= 20;
          x /= Math.pow(10,e);
          x += (new Array(e+1)).join('0');
      }
    }
    return x;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getContractBalanceEth() {
    return web3.eth.getBalance(mraContractAddress).add(web3.eth.getBalance(commonDataContractAddress));
}

eval(fs.readFileSync('./test/helpers/misc.js')+'');

describe('MINTARAMA', function() {

    before("Initialize everything", function(done) {
          web3.eth.getAccounts(function(err, as) {

               if(err) {
                    done(err);
                    return;
               }

               var i = 0;
               as.forEach(a => { addAccount(a, i == 0 ? "creator" : "buyer" + i); i++; });

               creator = as[0];
               buyer1 = as[1];
               buyer2 = as[2];
               buyer3 = as[3];
               buyer4 = as[4];
               buyer5 = as[5];

               newAdmin = as[9];

               done();
          });
    });

    after("Deinitialize everything", function(done) {
          done();
    });    



    it('should deploy token contract', function(done) {
          var data = {};

          deployMntContract(data,function(err) {
               assert.equal(err,null);

               deployEtheramaCommon(data, function(err) {
                    assert.equal(err,null);

                    deployEtheramaContract(data,function(err) {
                        assert.equal(err,null);
                        done();
                    });
               });
               

          });

    });


    it('should set initial state', async() => {

        await commonDataContract.addDataContract(mraContract.getDataContractAddress(), { from: creator });

        var mraContractTokenAmount = 2000000*ether;

        await mntContract.issueTokens(mraContractAddress, mraContractTokenAmount, { from: creator, gas: 2900000 });

        assert.equal(mraContractTokenAmount, mntContract.balanceOf(mraContractAddress));

        var buyerTokenAmount = 30000*ether;

        initTokenAmount = new BigNumber(buyerTokenAmount);

        await mntContract.issueTokens(buyer2, buyerTokenAmount, { from: creator, gas: 2900000 });

        assert.equal(buyerTokenAmount, mntContract.balanceOf(buyer2));

        addAccountInitBalance(buyer2, buyerTokenAmount);

        var buyer2MaxPurchase = await mraContract.getCurrentUserMaxPurchase({ from: buyer2, gas: 2900000 });

        assert.equal(buyerTokenAmount, buyer2MaxPurchase);

        await mntContract.issueTokens(buyer1, buyerTokenAmount, { from: creator, gas: 2900000 });        
        assert.equal(buyerTokenAmount, mntContract.balanceOf(buyer1));

        addAccountInitBalance(buyer1, buyerTokenAmount);

        await mntContract.issueTokens(buyer5, buyerTokenAmount, { from: creator, gas: 2900000 });        
        assert.equal(buyerTokenAmount, mntContract.balanceOf(buyer5));

        addAccountInitBalance(buyer5, buyerTokenAmount);
    });

    it('init vars', async() => {
        shareFeePercent = await mraContract.getShareRewardPercent().div(1e18);    
        refFeePercent = await mraContract.getRefBonusPercent().div(1e18);

        var priceSpeedPercent = await mraContract.getPriceSpeedPercent();
        var priceSpeedTokenBlock = await mraContract.getPriceSpeedTokenBlock();

        priceSpeed = (priceSpeedPercent / 100) / priceSpeedTokenBlock;
 
        devRewardPercent = await mraContract.getDevRewardPercent().div(1e18);
        startTokenPrice = await mraContract.getTokenInitialPrice().div(1e18);
        
        await commonDataContract.setBigPromoInterval(7, { from: creator });
        await commonDataContract.setQuickPromoInterval(5, { from: creator });

        bigPromoInterval = await mraContract.getBigPromoInterval();
        quickPromoInterval = await mraContract.getQuickPromoInterval();

        assert.equal(bigPromoInterval, 7);
        assert.equal(quickPromoInterval, 5);

        promoMinPurchaseEth = await commonDataContract.getPromoMinPurchaseEth();
        minRefTokenAmount = await mraContract.getMinRefTokenAmount();

        await mraContract.setActive(true, { from: creator });
    });

  /*  

    it('test estimations', async() => {
        var tokenDealRange = await mraContract.getTokenDealRange();
        var ethDealRange = await mraContract.getEthDealRange();

        console.log("tokenDealRange: " + tokenDealRange);
        console.log("ethDealRange: " + ethDealRange);
 
        var val = 10;
        var estBuy = await mraContract.estimateBuyOrder(val * ether, true);
        console.log("est buy " + val + " ether. Receive " + bignumToFloat(estBuy[0]) + " tokens by price " + bignumToFloat(estBuy[2]) + " eth/token; fee: " + bignumToFloat(estBuy[1]) + " eth");

        var val = 0.001;
        var estBuy = await mraContract.estimateBuyOrder(val * ether, true);
        console.log("est buy " + val + " ether: Receive " + bignumToFloat(estBuy[0]) + " tokens by price " + bignumToFloat(estBuy[2]) + " eth/token; fee: " + bignumToFloat(estBuy[1]) + " eth");



        var val = tokenDealRange[0].div(ether);
        var estBuy = await mraContract.estimateBuyOrder(val * ether, false);
        var etalonPrice = getEtalonPrice(new BigNumber((val * ether).toString(10)));
        console.log("est buy " + val + " token: Should pay " + bignumToFloat(estBuy[0]) + " eth by price " + bignumToFloat(estBuy[2]) + " eth/token;; fee: " + bignumToFloat(estBuy[1]) + " eth; etalon price: " + etalonPrice);
        var estBuy1 = await mraContract.estimateBuyOrder(ethDealRange[0], true);
        console.log("est buy " + bignumToFloat(ethDealRange[0]) + " ether: Receive " + bignumToFloat(estBuy1[0]) + " tokens by price " + bignumToFloat(estBuy1[2]) + " eth/token; fee: " + bignumToFloat(estBuy1[1]) + " eth");


        var val = tokenDealRange[0].div(ether);
        var estBuy = await mraContract.estimateBuyOrder(val * ether, false);
        var etalonPrice = getEtalonPrice(new BigNumber((val * ether).toString(10)));
        console.log("est buy " + val + " token: Should pay " + bignumToFloat(estBuy[0]) + " eth by price " + bignumToFloat(estBuy[2]) + " eth/token;; fee: " + bignumToFloat(estBuy[1]) + " eth; etalon price: " + etalonPrice);
        var estBuy1 = await mraContract.estimateBuyOrder(ethDealRange[0], true);
        console.log("est buy " + bignumToFloat(ethDealRange[0]) + " ether: Receive " + bignumToFloat(estBuy1[0]) + " tokens by price " + bignumToFloat(estBuy1[2]) + " eth/token; fee: " + bignumToFloat(estBuy1[1]) + " eth");
        //var delta = bignumToFloat(estBuy1[0]) - val;
        //assert(Math.abs(delta) < 0.002 * val);


        var val = tokenDealRange[1].div(ether);
        var estBuy = await mraContract.estimateBuyOrder(val * ether, false);
        var etalonPrice = getEtalonPrice(new BigNumber((val * ether).toString(10)));
        console.log("est buy " + val + " token: Should pay " + bignumToFloat(estBuy[0]) + " eth by price " + bignumToFloat(estBuy[2]) + " eth/token; ; fee: " + bignumToFloat(estBuy[1]) + "; etalon price: " + etalonPrice);
        
        var estBuy1 = await mraContract.estimateBuyOrder(ethDealRange[1], true);
        console.log("est buy " + bignumToFloat(ethDealRange[1]) + " ether: Receive " + bignumToFloat(estBuy1[0]) + " tokens by price " + bignumToFloat(estBuy1[2]) + " eth/token; fee: " + bignumToFloat(estBuy1[1]));
        //var delta = bignumToFloat(estBuy1[0]) - val;
        //assert(Math.abs(delta) < 0.002 * val);

       
        await mraContract.updateTokenPrice(realMath.toReal(1e6), { from: creator });
        var curTokenPrice = await getCurrentTokenPrice();
        console.log("curTokenPrice: " + curTokenPrice);

        var tokenDealRange = await mraContract.getTokenDealRange();
        var ethDealRange = await mraContract.getEthDealRange();
        console.log("tokenDealRange: " + tokenDealRange);
        console.log("ethDealRange: " + ethDealRange);

        var val = 1;
        var estSell = await mraContract.estimateSellOrder(val * ether, true);
        console.log("est sell " + val + " token: Receive " + bignumToFloat(estSell[0]) + " eth by price " + bignumToFloat(estSell[2]) + " eth/token; fee: " + bignumToFloat(estSell[1]) + " eth");
        
        var val = 50000;
        var estSell = await mraContract.estimateSellOrder(val * ether, true);
        console.log("est sell " + val + " token: Receive " + bignumToFloat(estSell[0]) + " eth by price " + bignumToFloat(estSell[2]) + " eth/token; fee: " + bignumToFloat(estSell[1]) + " eth");
        var val = 500;
        var estSell = await mraContract.estimateSellOrder(val * ether, true);
        console.log("est sell " + val + " token: Receive " + bignumToFloat(estSell[0]) + " eth by price " + bignumToFloat(estSell[2]) + " eth/token; fee: " + bignumToFloat(estSell[1]) + " eth");



        var val = ethDealRange[0].div(ether);
        var estSell = await mraContract.estimateSellOrder(val * ether, false);
        console.log("for receiving " + val + " ethers you should send " + bignumToFloat(estSell[0]) + " tokens by price " + bignumToFloat(estSell[2]) + " eth/token; fee: " + bignumToFloat(estSell[1]));
        var estSell1 = await mraContract.estimateSellOrder(tokenDealRange[0], true);
        var etalonPrice = getEtalonPrice(tokenDealRange[0].mul(-1));
        var delta = bignumToFloat(estSell1[0]) - val;
        console.log("est sell " + bignumToFloat(estSell[0]) + " token: Receive " + bignumToFloat(estSell1[0]) + " eth by price " + bignumToFloat(estSell1[2]) + " eth/token; ; fee: " + bignumToFloat(estSell1[1]) + "; etalon price: " + etalonPrice + "; delta: " + delta);

        //assert(Math.abs(delta) < 0.002 * val);

        var val = 10;//ethDealRange[1].div(ether);
        var estSell = await mraContract.estimateSellOrder(val * ether, false);
        console.log("for receiving " + val + " ethers you should send " + bignumToFloat(estSell[0]) + " tokens by price " + bignumToFloat(estSell[2]) + " eth/token; fee: " + bignumToFloat(estSell[1]));
/*
        var estSell1 = await mraContract.estimateSellOrder(tokenDealRange[1], true);
        var etalonPrice = getEtalonPrice(tokenDealRange[1].mul(-1));
        console.log("est sell " + bignumToFloat(tokenDealRange[1]) + " token: Receive " + bignumToFloat(estSell1[0]) + " eth by price " + bignumToFloat(estSell1[2]) + " eth/token; ; fee: " + bignumToFloat(estSell1[1]) + "; etalon price: " + etalonPrice);
        //var delta = bignumToFloat(estSell1[0]) - val;
        //assert(Math.abs(delta) < 0.002 * val);
        
    });  
*/


    it('should make a purchase behalf buyer1 1', async() => {
        {
            var ethAmount = 2 * ether;

            var mntpContractUserBalance1 = mntContract.balanceOf(buyer1);
            var mraContractUserBalance1 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer1 });


            var ethContractBalance1 = getContractBalanceEth();

            var userReward1 = await mraContract.getCurrentUserReward(true, false, { from: buyer1 });


            var est = await mraContract.estimateBuyOrder(ethAmount, true);
            console.log("est: " + est);
            var estimateTokenAmount = est[0]; 
            var totalPurchaseFee = est[1];

            var maxPurchaseTokenAmountAfterDeal = initTokenAmount.sub(mraContractUserBalance1).sub(estimateTokenAmount);


            updateTokenBalance(estimateTokenAmount);
            var expectedTokenPrice = getExpectedTokenPrice();
            var currentTokenPrice1 = await getCurrentTokenPrice();


            //console.log("expectedTokenPrice: " + expectedTokenPrice);

            var estimatedDevReward = Math.floor((devRewardPercent.add(shareFeePercent).add(refFeePercent)) * totalPurchaseFee / 100);
            //var estimatedDevReward = Math.floor((devRewardPercent) * totalPurchaseFee / 100);
            var devReward1 = await mraContract.getDevReward();
        }
        
        await mraContract.buy(0x0, estimateTokenAmount, { from: buyer1, gas: 2900000, gasPrice: 15000000000, value: ethAmount });
        {
            
            var mraContractUserBalance2 = mraContract.getCurrentUserLocalTokenBalance({ from: buyer1 });
            assert.equal((mraContractUserBalance2.sub(mraContractUserBalance1)).toString(10), estimateTokenAmount.toString(10));

            var mntpContractUserBalance2 = mntContract.balanceOf(buyer1);
            assert.equal(estimateTokenAmount.toString(10), (mntpContractUserBalance2.sub(mntpContractUserBalance1)).toString(10));
            
            var devReward2 = await mraContract.getDevReward();
            assert.equal(devReward2.sub(devReward1).toString(10), estimatedDevReward.toString(10));


            var ethContractBalance2 = getContractBalanceEth();
            assert.equal((ethContractBalance2.sub(ethContractBalance1)).toString(10), ethAmount.toString(10));

            var userReward2 = await mraContract.getCurrentUserReward(true, false, { from: buyer1 });
            assert.equal(userReward2.sub(userReward1).toString(10), "0");
         
            var currentTokenPrice2 = await getCurrentTokenPrice();
            //console.log("price diff: " + Math.abs(currentTokenPrice2 - expectedTokenPrice));
            console.log("token price: " + toFixed(currentTokenPrice2).toString(10) + "; expectedTokenPrice: " + toFixed(expectedTokenPrice).toString(10));

            assert(Math.abs(currentTokenPrice2 - expectedTokenPrice) < 1E-12);
            assert(currentTokenPrice2 > currentTokenPrice1);
            //console.log("currentTokenPrice2: " + currentTokenPrice2)

            var totalTokenSold2 = await mraContract.getTotalTokenSold({ from:creator });
            assert(totalTokenSold2.toString(10), estimateTokenAmount.toString(10));
            
            var maxPurchaseTokenAmount = await mraContract.getCurrentUserMaxPurchase({ from: buyer1 });
            assert.equal(maxPurchaseTokenAmount.toString(10), maxPurchaseTokenAmountAfterDeal.toString(10));

            initTotalTokenSupply = await mraContract.getTotalTokenSupply(); 
            
        }
    });


    it('should make a purchase behalf buyer1 2', async() => {
        {
            var ethAmount = 2 * ether;

            var mntpContractUserBalance1 = mntContract.balanceOf(buyer1);
            var mraContractUserBalance1 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer1 });

            var ethContractBalance1 = getContractBalanceEth();

            var userReward1 = await mraContract.getCurrentUserReward(true, false, { from: buyer1 });


            var est = await mraContract.estimateBuyOrder(ethAmount, true);
            var estimateTokenAmount = est[0]; 
            var totalPurchaseFee = est[1];

            var maxPurchaseTokenAmountAfterDeal = initTokenAmount.sub(mraContractUserBalance1).sub(estimateTokenAmount);


            updateTokenBalance(estimateTokenAmount);
            var expectedTokenPrice = getExpectedTokenPrice();
            var currentTokenPrice1 = await getCurrentTokenPrice();

            var totalShareReward = totalPurchaseFee * shareFeePercent / 100;
            var refReward = totalPurchaseFee * refFeePercent / 100;
            var totalTokenSold = await mraContract.getTotalTokenSold();

            var esitmatedShareReward = new BigNumber(Math.floor(((totalShareReward + refReward) / totalTokenSold) * mraContractUserBalance1).toString()); 

            console.log("esitmatedShareReward: " + esitmatedShareReward);

            var estimatedDevReward = Math.floor(devRewardPercent * totalPurchaseFee / 100);
            //var estimatedDevReward = Math.floor((devRewardPercent) * totalPurchaseFee / 100);
            var devReward1 = await mraContract.getDevReward();
        }
        
        await mraContract.buy(0x0, estimateTokenAmount, { from: buyer1, gas: 2900000, gasPrice: 15000000000, value: ethAmount });
        {
            var mraContractUserBalance2 = mraContract.getCurrentUserLocalTokenBalance({ from: buyer1 });
            assert.equal((mraContractUserBalance2.sub(mraContractUserBalance1)).toString(10), estimateTokenAmount.toString(10));

            var mntpContractUserBalance2 = mntContract.balanceOf(buyer1);
            assert.equal(estimateTokenAmount.toString(10), (mntpContractUserBalance2.sub(mntpContractUserBalance1)).toString(10));
            
            var devReward2 = await mraContract.getDevReward();
            assert.equal(devReward2.sub(devReward1).toString(10), estimatedDevReward.toString(10));

            var ethContractBalance2 = getContractBalanceEth();
            assert.equal((ethContractBalance2.sub(ethContractBalance1)).toString(10), ethAmount.toString(10));

            var userReward2 = await mraContract.getCurrentUserReward(true, false, { from: buyer1 });

            console.log("userReward1: " + userReward1.toString(10) + "; userReward2: " + userReward2.toString(10) + "; esitmatedShareReward: " + esitmatedShareReward.toString(10));
            assert(userReward2.sub(userReward1).sub(esitmatedShareReward).abs() < 100);
         
            var currentTokenPrice2 = await getCurrentTokenPrice();

            assert(Math.abs(currentTokenPrice2 - expectedTokenPrice) < 1E-12);
            assert(currentTokenPrice2 > currentTokenPrice1);
            //console.log("currentTokenPrice2: " + currentTokenPrice2)

            var totalTokenSold2 = await mraContract.getTotalTokenSold({ from:creator });
            assert(totalTokenSold2.toString(10), estimateTokenAmount.toString(10));
            
            var maxPurchaseTokenAmount = await mraContract.getCurrentUserMaxPurchase({ from: buyer1 });
            assert.equal(maxPurchaseTokenAmount.toString(10), maxPurchaseTokenAmountAfterDeal.toString(10));

        }
    });

    it('should make a purchase behalf buyer2', async() => {

        var ethAmount = 1.3 * ether;


        //purchase without a ref
        {
            var mntpContractUserBalance1 = mntContract.balanceOf(buyer2);
            var mraContractUserBalance1 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer2 });

            var ethContractBalance1 = getContractBalanceEth();


            var userReward1 = await mraContract.getCurrentUserReward(true, false, { from: buyer1 });
            var buyEst = await mraContract.estimateBuyOrder(ethAmount, true);

            var estimateTokenAmount = buyEst[0];
            var totalPurchaseFee = buyEst[1];

            updateTokenBalance(estimateTokenAmount);
            var expectedTokenPrice = getExpectedTokenPrice();
            var currentTokenPrice1 = await getCurrentTokenPrice();
            //console.log("expectedTokenPrice: " + expectedTokenPrice);

            var buyer1TokenBalance = await mraContract.getUserLocalTokenBalance(buyer1);

            var buyer2TokenBalance = await mraContract.getUserLocalTokenBalance(buyer2);
            //console.log("buyer2TokenBalance: " + buyer2TokenBalance);

            var estimatedDevReward = Math.floor(devRewardPercent * totalPurchaseFee / 100);
            var devReward1 = await mraContract.getDevReward();
            var totalShareReward = totalPurchaseFee * shareFeePercent / 100;
            var refReward = totalPurchaseFee * refFeePercent / 100;
            var totalTokenSold = await mraContract.getTotalTokenSold();

            var buyer2Reward1 = await mraContract.getCurrentUserReward(false, false, { from: buyer2 });
            //console.log("buyer2Reward1: " + buyer2Reward1);

            

            var esitmatedShareRewardWithoutRefBuyer1 = new BigNumber(Math.floor(((totalShareReward + refReward) / totalTokenSold) * buyer1TokenBalance).toString()); 
            var totalTokenSold1 = await mraContract.getTotalTokenSold({ from:creator });

            await mraContract.buy(0x0, estimateTokenAmount, { from: buyer2, gas: 2900000, value: ethAmount });
            {
 
                var mraContractUserBalance2 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer2, gas: 2900000 });
                assert.equal((mraContractUserBalance2.sub(mraContractUserBalance1)).toString(10), estimateTokenAmount.toString(10));

                var mntpContractUserBalance2 = mntContract.balanceOf(buyer2);
                assert.equal(estimateTokenAmount.toString(10), (mntpContractUserBalance2.sub(mntpContractUserBalance1)).toString(10));

                var ethContractBalance2 = getContractBalanceEth();
                assert.equal((ethContractBalance2.sub(ethContractBalance1)).toString(10), ethAmount.toString(10));

                var userReward2 = await mraContract.getCurrentUserReward(true, false, { from: buyer1 });
                console.log("userReward1: " + userReward1.toString(10) + "; userReward2: " + userReward2.toString(10) + "; esitmatedShareRewardWithoutRefBuyer1: " + esitmatedShareRewardWithoutRefBuyer1.toString(10));
                assert.equal(userReward2.sub(userReward1).sub(esitmatedShareRewardWithoutRefBuyer1).abs() < 200, true);

                var devReward2 = await mraContract.getDevReward();
                assert.equal(estimatedDevReward.toString(10), devReward2.sub(devReward1).toString(10));

                var buyer2Reward2 = await mraContract.getCurrentUserReward(false, false, { from: buyer2 });
                assert.equal(buyer2Reward2.sub(buyer2Reward1).toString(10), "0");
                    
                var currentTokenPrice2 = await getCurrentTokenPrice();
                assert(Math.abs(currentTokenPrice2 - expectedTokenPrice) < 1E-12);
                assert(currentTokenPrice2 > currentTokenPrice1);

                var totalTokenSold2 = await mraContract.getTotalTokenSold({ from:creator });
                assert(totalTokenSold2.sub(totalTokenSold1).toString(10), estimateTokenAmount.toString(10));
            }
        }

        //purchase with a ref
        {
            var buyer1TokenBalance = await mraContract.getUserLocalTokenBalance(buyer1);
            var buyEst = await mraContract.estimateBuyOrder(ethAmount, true);
            var estimateTokenAmount = buyEst[0];
            var totalPurchaseFee = buyEst[1];

            updateTokenBalance(estimateTokenAmount);
            var expectedTokenPrice = getExpectedTokenPrice();
            var currentTokenPrice1 = await getCurrentTokenPrice();

            var totalShareReward = totalPurchaseFee * shareFeePercent / 100;
            var totalRefReward = totalPurchaseFee * refFeePercent / 100;
            var totalTokenSold = await mraContract.getTotalTokenSold();

            esitmatedShareRewardWithRefBuyer1 = new BigNumber(Math.floor((totalShareReward / totalTokenSold) * buyer1TokenBalance).toString()); 
            totalRefReward = new BigNumber(totalRefReward.toString());

            buyer1Reward1 = await mraContract.getCurrentUserReward(true, false, { from: buyer1 });
            var totalTokenSold1 = await mraContract.getTotalTokenSold({ from:creator });

            await mraContract.buy(buyer1, estimateTokenAmount, { from: buyer2, gas: 2900000, value: ethAmount });    

            buyer1Reward2 = await mraContract.getCurrentUserReward(true, false, { from: buyer1 });

            //console.log("buyer1Reward1: " + buyer1Reward1.toString(10) + "; buyer1Reward2: " + buyer1Reward2.toString(10) + "; esitmatedShareRewardWithRefBuyer1: " + esitmatedShareRewardWithRefBuyer1.toString(10) + "; totalRefReward: " + totalRefReward.toString(10));

            assert(Math.abs(buyer1Reward2.sub(buyer1Reward1).sub(esitmatedShareRewardWithRefBuyer1).sub(totalRefReward)) < 200);
            
            var currentTokenPrice2 = await getCurrentTokenPrice();
            assert(Math.abs(currentTokenPrice2 - expectedTokenPrice) < 1E-12);
            assert(currentTokenPrice2 > currentTokenPrice1);

            var totalTokenSold2 = await mraContract.getTotalTokenSold({ from:creator });
            assert(totalTokenSold2.sub(totalTokenSold1).toString(10), estimateTokenAmount.toString(10));
        }

    });

    it('should not make a purchase behalf buyer3',  function(done) {

        var ethAmount = 2.5 * ether;
        mraContract.estimateBuyOrder(ethAmount, true, function(err, est) {

            var estimateTokenAmount = est[0]; 
            
            mraContract.getCurrentUserMaxPurchase({ from: buyer3, gas: 2900000 }, function(err, maxPurchase) {
                
                assert(maxPurchase.sub(estimateTokenAmount) < 0);
    
                web3.eth.sendTransaction({ from: buyer3, to: mraContractAddress, value: ethAmount, gas: 2900000 }, function(err, res) {
                    assert.notEqual(err, null);   
        
                    done();
                });

            });

        });

    });

    it('should make a purchase behalf buyer3', async() => {

        var ethAmount = 2.5 * ether;

        var est = await mraContract.estimateBuyOrder(ethAmount, true);
        var estimateTokenAmount = est[0]; 

        await mntContract.issueTokens(buyer3, estimateTokenAmount, { from: creator, gas: 2900000 });
        addAccountInitBalance(buyer3, estimateTokenAmount);

        var mntpContractUserBalance1 = mntContract.balanceOf(buyer3);
        
        updateTokenBalance(estimateTokenAmount);
        var expectedTokenPrice = getExpectedTokenPrice();
        var currentTokenPrice1 = await getCurrentTokenPrice();
        //console.log("currentTokenPrice1: " + currentTokenPrice1.toString(10));

        var totalTokenSold1 = await mraContract.getTotalTokenSold({ from:creator });

        await web3.eth.sendTransaction({ from: buyer3, to: mraContractAddress, value: ethAmount, gas: 2900000 });

        var mntpContractUserBalance2 = mntContract.balanceOf(buyer3);
        assert.equal(estimateTokenAmount.toString(10), (mntpContractUserBalance2.sub(mntpContractUserBalance1)).toString(10));

        var currentTokenPrice2 = await getCurrentTokenPrice();
        //console.log("currentTokenPrice2: " + currentTokenPrice2.toString(10) + "; expectedTokenPrice: " + expectedTokenPrice.toString(10));
        assert(Math.abs(currentTokenPrice2 - expectedTokenPrice) < 1E-12);
        assert(currentTokenPrice2 > currentTokenPrice1);

        var totalTokenSold2 = await mraContract.getTotalTokenSold({ from:creator });
        assert(totalTokenSold2.sub(totalTokenSold1).toString(10), estimateTokenAmount.toString(10));
    });

    it('should approve transfer behalf buyer1', async() => {

        var tokenAmount = 10 * ether;

        await mntContract.approve(mraContractAddress, tokenAmount, { from: buyer1, gas: 2900000});

        assert.equal(tokenAmount.toString(10), mntContract.allowance(buyer1, mraContractAddress).toString(10));

    });

    it('should not make a sell', function(done) {
        var tokenAmount = 20 * ether;

        mraContract.sell(tokenAmount, 1, { from: buyer1, gas: 2900000}, function(err, res) {
            assert.notEqual(err, null);   

            done(); 
        });
    });     

    it('should make a sell behalf buyer1', async() => {
        //init vars
        {
            var tokenAmount = new BigNumber((10 * ether).toString());

            var mraContractUserBalance1 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer1 });
            var buyer1TokenBalance = await mraContract.getUserLocalTokenBalance(buyer1);
            var buyer2TokenBalance = await mraContract.getUserLocalTokenBalance(buyer2);

            assert(buyer1TokenBalance > tokenAmount);
            
            var buyer1Reward1 = await mraContract.getCurrentUserReward(false, false, { from: buyer1 });
            var buyer2Reward1 = await mraContract.getCurrentUserReward(false, false, { from: buyer2 });

            var mntpContrantPowhBalance1 = mntContract.balanceOf(mraContractAddress);

            var sellEst = await mraContract.estimateSellOrder(tokenAmount, true);             
            var estimatedEthAmount = sellEst[0];
            var estimatedTotalFee = sellEst[1];
            //console.log("estimatedEthAmount: " + estimatedEthAmount.toString(10) + "; estimatedTotalFee: " + estimatedTotalFee.toString(10) + "; shareFeePercent: " + shareFeePercent);

            updateTokenBalance(tokenAmount.mul(-1));
            var expectedTokenPrice = getExpectedTokenPrice();
            var currentTokenPrice1 = await getCurrentTokenPrice();
            //console.log("expectedTokenPrice: " + expectedTokenPrice);

            var totalShareReward = estimatedTotalFee * (shareFeePercent.add(refFeePercent)) / 100;
            var totalTokenSold = await mraContract.getTotalTokenSold();
            //console.log("totalShareReward: " + totalShareReward + "; totalTokenSold: " + totalTokenSold.toString(10));

            var estimatedDevReward = Math.floor(devRewardPercent * estimatedTotalFee / 100);


            var buyer2EsitmatedShareReward = new BigNumber(Math.floor((totalShareReward / (totalTokenSold.sub(tokenAmount))) * buyer2TokenBalance).toString()); 
            var buyer1EsitmatedShareReward = new BigNumber(Math.floor((totalShareReward / (totalTokenSold.sub(tokenAmount))) * buyer1TokenBalance).toString()); 

            var devReward1 = await mraContract.getDevReward();
            
            var ethPowhContractBalance1 = getContractBalanceEth();
            var ethBuyer1Balance1 = web3.eth.getBalance(buyer1);

            var totalTokenSold1 = await mraContract.getTotalTokenSold({ from:creator });
            //console.log("totalTokenSold1: " + totalTokenSold1.toString(10));
        }

        await mraContract.sell(tokenAmount, estimatedEthAmount, { from: buyer1, gas: 2900000});
        {
            var buyer2Reward2 = await mraContract.getCurrentUserReward(false, false, { from: buyer2 });

            //console.log("buyer2Reward1: " + buyer2Reward1.toString(10) + "; buyer2Reward2: " + buyer2Reward2.toString(10) + "; buyer2EsitmatedShareReward: " + buyer2EsitmatedShareReward.toString(10));

            assert(buyer2Reward2.sub(buyer2Reward1).sub(buyer2EsitmatedShareReward).abs() < 200);   
            var buyer1Reward2 = await mraContract.getCurrentUserReward(false, false, { from: buyer1 });
            /*
            console.log("buyer1Reward1: " + buyer1Reward1);
            console.log("buyer1Reward2: " + buyer1Reward2);
            console.log("buyer1EsitmatedShareReward: " + buyer1EsitmatedShareReward);
            */
            var mntpContrantPowhBalance2 = mntContract.balanceOf(mraContractAddress);
            assert.equal((mntpContrantPowhBalance2.sub(mntpContrantPowhBalance1)).toString(10), tokenAmount.toString(10));

            var ethPowhContractBalance2 = getContractBalanceEth();
            var ethBuyer1Balance2 = web3.eth.getBalance(buyer1);

            assert.equal((ethPowhContractBalance1.sub(ethPowhContractBalance2)).toString(10), estimatedEthAmount.toString(10));

            assert(ethBuyer1Balance2.sub(ethBuyer1Balance1).sub(estimatedEthAmount) < 10000000000);

            var mraContractUserBalance2 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer1 });

            assert.equal((mraContractUserBalance1.sub(mraContractUserBalance2)).toString(10), tokenAmount.toString(10));

            var devReward2 = await mraContract.getDevReward();
            assert.equal(estimatedDevReward.toString(10), devReward2.sub(devReward1).toString(10));    


            var esitmatedShareRewardForSoldTokens = await mraContract.calcReward(tokenAmount);
            //console.log("esitmatedShareRewardForSoldTokens: " + esitmatedShareRewardForSoldTokens);

            var currentTokenPrice2 = await getCurrentTokenPrice();
            //console.log("currentTokenPrice: " + currentTokenPrice);
            assert(Math.abs(currentTokenPrice2 - expectedTokenPrice) < 1E-12);    
            assert(currentTokenPrice1 > currentTokenPrice2); 
            
            var totalTokenSold2 = await mraContract.getTotalTokenSold({ from:creator });
            //console.log("totalTokenSold2: " + totalTokenSold2.toString(10));
            assert(totalTokenSold1.sub(totalTokenSold2).toString(10), tokenAmount.toString(10));
        } 
          
    });

    it('should withdraw reward', async() => {
        
        var buyer1EthBalance1 = web3.eth.getBalance(buyer1);
        var buyer1Reward1 = await mraContract.getCurrentUserReward(true, true, { from: buyer1 });

        //console.log("buyer1Reward1: " + buyer1Reward1.toString(10));
        assert(buyer1Reward1 > 0);
        await mraContract.withdraw({ from: buyer1 });

        var buyer1EthBalance2 = web3.eth.getBalance(buyer1);
        var buyer1Reward2 = await mraContract.getCurrentUserReward(true, true, { from: buyer1 });
        //console.log("buyer1Reward2: " + buyer1Reward2.toString(10));
        
        assert(Math.abs(buyer1EthBalance2.sub(buyer1EthBalance1).sub(buyer1Reward1)) < 100000);

        assert.equal(buyer1Reward2.toString(10), "0");
    });

    it('should check promo bonuses', async() => {

        var promoBonus1 = await mraContract.getCurrentUserTotalPromoBonus({ from: buyer1 });
        
        await updateBlockNum();
    
        if (blockNum % quickPromoInterval == 0) await mraContract.buy(0x0, 1, { from: buyer1, gas: 2900000, value: 0.01 * ether });
        
        //should not win if a purchase is too small
        
        {
            await updateBlockNum();
    
            while(blockNum % quickPromoInterval != 0) {
                var promoBonus = await mraContract.getCurrentUserTotalPromoBonus({ from: buyer1 });
                var ethAmount = promoMinPurchaseEth * 0.4;
    
                assert(promoBonus.sub(promoBonus1) == 0);
    
                var est = await mraContract.estimateBuyOrder(ethAmount, true);
                var estimateTokenAmount = est[0]; 
                //console.log("buy est: " + est);
    
                var curMaxPurchase = await mraContract.getCurrentUserMaxPurchase({ from: buyer1 });
                //console.log("curMaxPurchase: " + curMaxPurchase + "; estimateTokenAmount: " + estimateTokenAmount);
                assert(curMaxPurchase.sub(estimateTokenAmount) > 0);
    
                await mraContract.buy(0x0, estimateTokenAmount, { from: buyer1, gas: 2900000, value: ethAmount });
    
    
                await updateBlockNum();
                promoBonus = await mraContract.getCurrentUserTotalPromoBonus({ from: buyer1 });
            }
    
            var promoBonus2 = await mraContract.getCurrentUserTotalPromoBonus({ from: buyer1 });
    
            assert(promoBonus2.sub(promoBonus1) == 0);
        }
    
        var promoBonus1 = await mraContract.getCurrentUserQuickPromoBonus({ from: buyer1 });
    
        // should win a quick promo if a purchase is enough
        {
            var ethAmount = promoMinPurchaseEth;
            var est = await mraContract.estimateBuyOrder(ethAmount, true);
            var estimateTokenAmount = est[0]; 
            await updateBlockNum();
    
            if (blockNum % quickPromoInterval == 0) await mraContract.buy(0x0, 1, { from: buyer1, gas: 2900000, value: 0.01 * ether });
            await updateBlockNum();
    
            //should win a quick promo
            while(blockNum % quickPromoInterval != 0) {
                //console.log("rem block: " + await mraContract.getQuickPromoRemainingBlocks())
                var promoBonus = await mraContract.getCurrentUserQuickPromoBonus({ from: buyer1 });
                //console.log("1 - blockNum: " + blockNum + "; promoBonus: " + promoBonus.toString(10) +"; promoBonus1: " + promoBonus1.toString(10));
    
                assert(promoBonus.sub(promoBonus1) == 0);
                var mraContractUserBalance2 = mraContract.getCurrentUserLocalTokenBalance({ from: buyer1 });
                var maxPurchaseTokenAmount = await mraContract.getCurrentUserMaxPurchase({ from: buyer1 });
                //console.log("mraContractUserBalance2: " + mraContractUserBalance2.toString(10) + "; maxPurchaseTokenAmount: " + maxPurchaseTokenAmount.toString(10) + "; tokenAmount: " + estimateTokenAmount.toString(10));
    
                await mraContract.buy(0x0, 1, { from: buyer1, gas: 400000, value: ethAmount });
                await updateBlockNum();
                promoBonus = await mraContract.getCurrentUserQuickPromoBonus({ from: buyer1 });
                //console.log("2 - blockNum: " + blockNum + "; getCurrentUserQuickPromoBonus: " + promoBonus.toString(10) +"; promoBonus1: " + promoBonus1.toString(10));
            }
    
            var promoBonus2 = await mraContract.getCurrentUserQuickPromoBonus({ from: buyer1 });
            //console.log("promoBonus2: " + promoBonus2);
            assert(promoBonus2.sub(promoBonus1) > 0);
    
            await updateBlockNum();
            if (blockNum % bigPromoInterval == 0) await mraContract.buy(0x0, 1, { from: buyer1, gas: 2900000, value: 0.01 * ether });
            
            await updateBlockNum();
    
            var promoBonus3 = await mraContract.getCurrentUserBigPromoBonus({ from: buyer1 });
    
            //should win a big promo
            while(blockNum % bigPromoInterval != 0) {
                console.log("rem block: " + await mraContract.getBigPromoRemainingBlocks())
    
                var promoBonus = await mraContract.getCurrentUserBigPromoBonus({ from: buyer1 });
    
                assert(promoBonus.sub(promoBonus3) == 0);
    
                await mraContract.buy(0x0, 1, { from: buyer1, gas: 2900000, value: ethAmount });
                await updateBlockNum();
                //console.log("blockNum: " + blockNum + "; promoBonus: " + promoBonus.toString(10) +"; promoBonus2: " + promoBonus2.toString(10));
            }
    
            var promoBonus4 = await mraContract.getCurrentUserBigPromoBonus({ from: buyer1 });
            console.log("promoBonus4: " + promoBonus4);
            assert(promoBonus4.sub(promoBonus3) > 0);
        }
    });

    it('should reinvest reward', async() => {

        var ethAmount = 1 * ether;
        var est = await mraContract.estimateBuyOrder(ethAmount, true);
        var estimateTokenAmount = est[0];
        

        await mraContract.buy(0x0, estimateTokenAmount, { from: buyer1, gas: 2900000, value: ethAmount });    

        await mntContract.issueTokens(buyer3, estimateTokenAmount, { from: creator, gas: 2900000 });
        addAccountInitBalance(buyer3, estimateTokenAmount);

        await mraContract.buy(buyer1, 1, { from: buyer3, gas: 2900000, value: ethAmount });    


        var buyer1Reward1 = await mraContract.getCurrentUserReward(true, true, { from: buyer1 });
        console.log("buyer1Reward1: " + buyer1Reward1.toString(10));


        assert(buyer1Reward1 > 0);

        
        var est = await mraContract.estimateBuyOrder(buyer1Reward1, true);
        var estimateTokenAmount = est[0];
        var totalPurchaseFee = est[1];

        //console.log("estimateTokenAmount: " + estimateTokenAmount.toString(10));

        var buyer1TokenBalance1 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer1 });

        
        var totalShareReward = totalPurchaseFee * shareFeePercent / 100;
        var refReward = totalPurchaseFee * refFeePercent / 100;
        var totalTokenSold = await mraContract.getTotalTokenSold();

        var esitmatedShareReward = new BigNumber(Math.floor(((totalShareReward + refReward) / totalTokenSold) * buyer1TokenBalance1).toString()); 


        await mraContract.reinvest({ from: buyer1, gas: 2900000 });

        var buyer1Reward2 = await mraContract.getCurrentUserReward(true, true, { from: buyer1 });
        console.log("buyer1Reward2: " + buyer1Reward2.toString(10));
        console.log("esitmatedShareReward: " + esitmatedShareReward.toString(10));

        //assert(buyer1Reward2.toString(10) == "0");

        var buyer1TokenBalance2 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer1 });

        assert(buyer1TokenBalance2 > buyer1TokenBalance1);

        //console.log("buyer1TokenBalance2: " + buyer1TokenBalance2.toString(10));

        assert.equal(buyer1TokenBalance2.sub(buyer1TokenBalance1).sub(estimateTokenAmount).toString(10), "0");

    });


    it('should withdraw dev reward', async() => {

        var devReward1 = await mraContract.getDevReward({ from: creator });

        var devEthBalance1 = web3.eth.getBalance(creator);
        //console.log("devReward1: " + devReward1.toString(10));
        //console.log("devEthBalance1: " + devEthBalance1.toString(10));

        await mraContract.withdrawDevReward(creator, { from: creator });

        var devReward2 = await mraContract.getDevReward({ from: creator, gas: 2900000 });
        assert.equal(devReward2.toString(10), "0");

        var devEthBalance2 = web3.eth.getBalance(creator);

        //console.log("devEthBalance2: " + devEthBalance2.toString(10));

        assert(Math.abs(devEthBalance2.sub(devEthBalance1).sub(devReward1)) < 30000);

    });

    it('should test economy model', async() => {

        //sell all tokens back
        {
            var mraContractEthBalance = web3.eth.getBalance(mraContractAddress);
            console.log("1 (start balance): " + mraContractEthBalance.div(1e18).toString(10));


            assert.equal(initTotalTokenSupply.toString(10), (await mraContract.getTotalTokenSupply()).toString(10));

            //console.log("mraContractTokenBalance1: " + mntContract.balanceOf(mraContractAddress).toString(10));

            var tokenPrice1 = await mraContract.get1TokenBuyPrice();
            //console.log("tokenPrice1 " + tokenPrice1);
            var tokensSold1 = await mraContract.getTotalTokenSold({ from: creator });

            
            // sell all tokens back
            {
                var buyer1TokenBalance1 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer1 });
                if (buyer1TokenBalance1.toString(10) != "0") {
                    await mntContract.approve(mraContractAddress, buyer1TokenBalance1, { from: buyer1, gas: 2900000});
                    await mraContract.sell(buyer1TokenBalance1, 1, { from: buyer1, gas: 2900000});
                    updateTokenBalance(buyer1TokenBalance1.mul(-1));
                }

                var buyer2TokenBalance1 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer2 });
                if (buyer2TokenBalance1.toString(10) != "0") {
                    await mntContract.approve(mraContractAddress, buyer2TokenBalance1, { from: buyer2, gas: 2900000});
                    await mraContract.sell(buyer2TokenBalance1, 1, { from: buyer2, gas: 2900000});
                    updateTokenBalance(buyer2TokenBalance1.mul(-1));
                }

                var buyer3TokenBalance1 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer3 });
                if (buyer3TokenBalance1.toString(10) != "0") {
                    await mntContract.approve(mraContractAddress, buyer3TokenBalance1, { from: buyer3, gas: 2900000});
                    await mraContract.sell(buyer3TokenBalance1, 1, { from: buyer3, gas: 2900000});
                    updateTokenBalance(buyer3TokenBalance1.mul(-1));
                }

                var buyer4TokenBalance1 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer4 });
                if (buyer4TokenBalance1.toString(10) != "0") {
                    await mntContract.approve(mraContractAddress, buyer4TokenBalance1, { from: buyer4, gas: 2900000});
                    await mraContract.sell(buyer4TokenBalance1, 1, { from: buyer4, gas: 2900000});
                    updateTokenBalance(buyer4TokenBalance1.mul(-1));
                }

                var buyer1TokenBalance2 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer1 });
                var buyer2TokenBalance2 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer2 });
                var buyer3TokenBalance2 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer3 });
                var buyer4TokenBalance2 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer4 });

                //console.log("totalTokenBalance: " + totalTokenBalance.toString(10)); 
                //assert.equal(totalTokenBalance, 0);

                assert(buyer1TokenBalance2.toString(10), "0");
                assert(buyer2TokenBalance2.toString(10), "0");
                assert(buyer3TokenBalance2.toString(10), "0");
                assert(buyer4TokenBalance2.toString(10), "0");

                var tokensSold2 = await mraContract.getTotalTokenSold({ from: creator });
                assert.equal(tokensSold2.toString(10), "0");

                var tokenPrice2 = await getCurrentTokenPrice();
                assert(Math.abs(tokenPrice2 - startTokenPrice) < 1E-12);

            }

            var mraContractEthBalance = web3.eth.getBalance(mraContractAddress);
            console.log("2 (after selling all tokens back): " + mraContractEthBalance.div(1e18).toString(10));

            var buyer1Reward1 = await mraContract.getCurrentUserReward({ from: buyer1 }, true, false);
            var buyer2Reward1 = await mraContract.getCurrentUserReward({ from: buyer2 }, true, false);
            var buyer3Reward1 = await mraContract.getCurrentUserReward({ from: buyer3 }, true, false);
            var buyer4Reward1 = await mraContract.getCurrentUserReward({ from: buyer4 }, true, false);

            var totalBuyerReward = buyer1Reward1.add(buyer2Reward1).add(buyer3Reward1).add(buyer4Reward1);

            var devReward = await mraContract.getDevReward();
            var totalPromoReward = await mraContract.getTotalCollectedPromoBonus();

            var totalDiff = mraContractEthBalance.sub(devReward).sub(totalPromoReward).sub(totalBuyerReward);

            console.log("promo reward: " + totalPromoReward.div(1e18).toString(10));
            console.log("devReward: " + devReward.div(1e18).toString(10));
            console.log("total diff: " + totalDiff.div(1e18).toString(10));

            assert(totalDiff >= 0);
        }


    });

    it('should test price formula', async() => {

        totalTokenBalance = 0;
        assert(totalTokenBalance == 0);

        var expectedTokenPrice = getExpectedTokenPrice();
        assert.equal(expectedTokenPrice.toString(10), startTokenPrice.toString(10));

        for (var dealNum = 0; dealNum < 25; dealNum++) {

            var isBuy = totalTokenBalance > 0 ? getRandomInt(0, 1) == 1 : true;

            if (isBuy) {
                var ethAmount = new BigNumber(((Math.round(getRandomInt(0, 4) * Math.random() * 1000) / 1000) * ether).toString());
                if (ethAmount == 0) continue;

                //console.log("dealNum: " + dealNum + "; buy for " + ethAmount.div(ether) + " eth");

                var est = await mraContract.estimateBuyOrder(ethAmount, true);
                var estimateTokenAmount = est[0]; 
                updateTokenBalance(estimateTokenAmount);
                expectedTokenPrice = getExpectedTokenPrice();

                await mraContract.buy(0x0, estimateTokenAmount, { from: buyer5, gas: 2900000, value: ethAmount });

                //console.log("bought");

                var tokenPrice = await getCurrentTokenPrice();
                assert(Math.abs(tokenPrice - expectedTokenPrice) < 1E-12);    

            } else {
                var buyer5TokenBalance = (await mraContract.getCurrentUserLocalTokenBalance({ from: buyer5 }));
                var tokenAmount = new BigNumber(((Math.round(getRandomInt(0, Math.round(bignumToFloat(buyer5TokenBalance))) * Math.random() * 1000) / 1000) * ether).toString());
                if (tokenAmount == 0) continue;
                //console.log("dealNum: " + dealNum + "; sell " + tokenAmount.div(ether) + " tokens");

                var estSell = await mraContract.estimateSellOrder(tokenAmount, true);
                //console.log("est sell " + tokenAmount.div(ether) + " token: Receive " + bignumToFloat(estSell[0]) + " eth by price " + bignumToFloat(estSell[2]) + " eth/token");
        
                updateTokenBalance(tokenAmount.mul(-1));
                expectedTokenPrice = getExpectedTokenPrice();

                await mntContract.approve(mraContractAddress, tokenAmount, { from: buyer5, gas: 2900000});
                await mraContract.sell(tokenAmount, estSell[0], { from: buyer5, gas: 2900000});

                //console.log("sold");
                
                var tokenPrice = await getCurrentTokenPrice();
                assert(Math.abs(tokenPrice - expectedTokenPrice) < 1E-12);    
            }

            //console.log("next iteration");
            
        }

        //sell all the remaings

        var buyer5TokenBalance = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer5 });
        console.log("sell remainings: " + buyer5TokenBalance.div(ether) + " tokens; totalTokenBalance: " + totalTokenBalance);
        assert(Math.abs(totalTokenBalance - bignumToFloat(buyer5TokenBalance)) < 1E-12);    

        updateTokenBalance(buyer5TokenBalance.mul(-1));
        var expectedTokenPrice = getExpectedTokenPrice();
        assert.equal(expectedTokenPrice.toString(10), startTokenPrice.toString(10));

        var estSell = await mraContract.estimateSellOrder(buyer5TokenBalance, true);
        //console.log("est sell " + buyer5TokenBalance.div(ether) + " token: Receive " + bignumToFloat(estSell[0]) + " eth by price " + bignumToFloat(estSell[2]) + " eth/token");

        await mntContract.approve(mraContractAddress, buyer5TokenBalance, { from: buyer5, gas: 2900000});
        await mraContract.sell(buyer5TokenBalance, estSell[0], { from: buyer5, gas: 2900000});

        var tokenPrice = await getCurrentTokenPrice();
        //console.log("finish price is " + tokenPrice.toString(10));

        assert(Math.abs(tokenPrice - startTokenPrice) < 1E-12);        
    });

    
    it('should transfer ownership', function(done) {
        mraContract.transferOwnership(newAdmin, { from: creator }, function(err) {
            assert.equal(err, null);

            mraContract.acceptOwnership({ from: newAdmin }, function(err) {
                assert.equal(err, null);
                
                mraContract.addAdministator(buyer5, { from: creator }, function(err) {
                    assert.notEqual(err, null);
                    done();
                });
            })
            
        });

    });


});

describe('ETHERARAMA NEW CONTROLLER', function(){

    before("Initialize everything", function(done) {
        web3.eth.getAccounts(function(err, as) {

                if(err) {
                    done(err);
                    return;
                }

                var i = 0;
                as.forEach(a => { addAccount(a, i == 0 ? "creator" : "buyer" + i); i++; });

                creator = as[0];
                buyer1 = as[1];
                buyer2 = as[2];
                buyer3 = as[3];
                buyer4 = as[4];
                buyer5 = as[5];

                done();
        });
    });

    after("Deinitialize everything", function(done) {
        done();
    });    

    it('should deploy token contract', function(done) {
        var data = {};

        mraContractOld = mraContract;
        mraContractAddressOld = mraContractAddress;

        mraContract.getDataContractAddress(data, function(err, res){

            dataContractAddress = res;

            console.log("dataContractAddress: " + dataContractAddress);

            deployEtheramaContract(data, function(err){
                assert.equal(err,null);
    
                done();
            });

        });

    });

    it('should change controller', async() => {

        await mraContractOld.buy(0x0, { from: buyer1, gas: 2900000, value: 2 * ether });

        var oldContractTokenBalance = await mraContractOld.getRemainingTokenAmount();
        var oldContractEthBalance = await mraContractOld.getTotalEthBalance();
        var buyer1TokenBalance1 = await mraContractOld.getCurrentUserLocalTokenBalance({ from: buyer1 });

        assert(oldContractTokenBalance > 0);
        assert(oldContractEthBalance > 0);
        assert(buyer1TokenBalance1 > 0);

        await mraContract.setMigrationStatus(true, { from: creator, gas: 300000 });
        await mraContractOld.setNewControllerContractAddress(mraContractAddress, { from: creator, gas: 300000 });
        await mraContract.setMigrationStatus(false, { from: creator, gas: 300000 });


        assert(await mraContract.getDataContractAddress(), await mraContractOld.getDataContractAddress());

        var buyer1TokenBalance2 = await mraContract.getCurrentUserLocalTokenBalance({ from: buyer1 });
        assert.equal(buyer1TokenBalance2.toString(10), buyer1TokenBalance1.toString(10));


        var newContractTokenBalance = await mraContract.getRemainingTokenAmount();
        var newContractEthBalance = await mraContract.getTotalEthBalance();

        assert.equal(newContractTokenBalance.toString(10), oldContractTokenBalance.toString(10));
        assert.equal(await mraContractOld.getRemainingTokenAmount().toString(10), "0");

        assert.equal(newContractEthBalance.toString(10), oldContractEthBalance.toString(10));
    });

    it('old controller should not receive ethers anymore', function(done) {

        var ethAmount = 2 * ether;

        mraContractOld.buy(0x0, { from: buyer1, gas: 2900000, value: ethAmount }, function(err, res) {
            assert.notEqual(err, null);

            web3.eth.sendTransaction({ from: buyer1, to: mraContractAddressOld, value: ethAmount, gas: 2900000 }, function(err1, res) {
                assert.notEqual(err1, null);

                web3.eth.sendTransaction({ from: buyer1, to: mraContractAddress, value: ethAmount, gas: 2900000 }, function(err1, res) {
                    assert.notEqual(err1, null);
                    done();
                });
            });
        });
    });

    it('should activate new controller', async() => {

        await mraContract.setActive(true, { from: creator });

        await web3.eth.sendTransaction({ from: buyer1, to: mraContractAddress, value: 0.1 * ether, gas: 2900000 });

    });

});