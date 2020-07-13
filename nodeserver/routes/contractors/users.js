var express = require('express');
var router = express.Router();
const bodyParser = require('body-parser');
const FabricCAServices = require('fabric-ca-client');
const { Wallets, Gateway } = require('fabric-network');
const fs = require('fs');
const path = require('path');

const cors = require('../../cors');

const numGailNodes=2;
var dict=new Map();

router.use(bodyParser.json());

router.options('*', cors.corsWithOptions, (req, res) => { res.sendStatus(200); });

/* GET users listing. */
router.post('/login', async function(req, res, next) {
    // load the network configuration
    const ccpPath = path.resolve(__dirname, '..', '..', '..', 'fabric', 'test-network', 'organizations',
    'peerOrganizations', 'contractors.example.com', 'connection-contractors.json');
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

    // Create a new file system based wallet for managing identities.
    const walletPath = path.join(__dirname, 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // Check to see if we've already enrolled the user.
    const identity = await wallet.get(req.body.username);
    if (!identity) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.json({
            success: false,
            message: 'User with username: ' + req.body.username + ' does not exist'
        });
    }
    else{
        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: req.body.username,
            discovery: { enabled: true, asLocalhost: true } });

        var channelNum=dict.get(req.body.username);

        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork('channelg0c'+channelNum);

        // Get the contract from the network.
        const contract = network.getContract('contractors');

        const user = await contract.evaluateTransaction('getUser', req.body.username, req.body.password);
        // Disconnect from the gateway.
        await gateway.disconnect();

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.json(JSON.parse(user.toString()));
    }
});

router.post('/signup', async function(req, res, next){
    // load the network configuration
    const ccpPath = path.resolve(__dirname, '..', '..', '..', 'fabric', 'test-network', 'organizations',
    'peerOrganizations', 'contractors.example.com', 'connection-contractors.json');
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

    // Create a new CA client for interacting with the CA.
    const caURL = ccp.certificateAuthorities['ca.contractors.example.com'].url;
    const ca = new FabricCAServices(caURL);

    // Create a new file system based wallet for managing identities.
    const walletPath = path.join(__dirname, 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // Check to see if we've already enrolled the user.
    const userIdentity = await wallet.get(req.body.username);
    if (userIdentity) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.json({
            success: false,
            message: 'User with username: ' + req.body.username + ' already exists in the wallet'
        });
    }
    else{
        // Check to see if we've already enrolled the admin user.
        const adminIdentity = await wallet.get('admin');
        if (!adminIdentity) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.json({
                success: false,
                message: 'admin should be registered before registering client user'
            });
        }
        else{
            // build a user object for authenticating with the CA
            const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
            const adminUser = await provider.getUserContext(adminIdentity, 'admin');

            // Register the user, enroll the user, and import the new identity into the wallet.
            const secret = await ca.register({
                enrollmentID: req.body.username,
                role: 'client',
                enrollmentSecret: req.body.password
            }, adminUser);
            const enrollment = await ca.enroll({
                enrollmentID: req.body.username,
                enrollmentSecret: secret
            });
            const x509Identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes(),
                },
                mspId: 'GailMSP',
                type: 'X.509',
            };
            await wallet.put(req.body.username, x509Identity);

            // Check to see if we've already enrolled the user.
            const identity = await wallet.get(req.body.username);
            if (!identity) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.json({
                    success: false,
                    message: 'User registration failed'
                });
            }
            else{
                // Create a new gateway for connecting to our peer node.
                const ccpGailPath = path.resolve(__dirname, '..', '..', '..', 'fabric', 'test-network', 'organizations',
                'peerOrganizations', 'gail.example.com', 'connection-gail.json');
                console.log('log : 1');
                const ccpGail = JSON.parse(fs.readFileSync(ccpGailPath, 'utf8'));
                console.log('log : 2');
                const gailWalletPath = path.resolve(__dirname, '..','gail','wallet');
                console.log(gailWalletPath);
                const gailWallet = await Wallets.newFileSystemWallet(gailWalletPath);
                console.log('log : 4');
                const xyz = await gailWallet.get('admin');
                if(xyz)
                    console.log(xyz);
                const gatewayGail = new Gateway();
                console.log('log : 5');
                await gatewayGail.connect(ccpGail, { gailWallet, identity: 'dummyadmin',
                    discovery: { enabled: true, asLocalhost: true } });

                console.log('I am here');

                const gateway = new Gateway();
                await gateway.connect(ccp, { wallet, identity: req.body.username,
                    discovery: { enabled: true, asLocalhost: true } });

                // Get the network (channel) our contract is deployed to.
                const network = await gatewayGail.getNetwork('channelgg');

                // Get the contract from the network.
                const contract = network.getContract('gail');
                const numContractors=await contract.evaluateTransaction('getNumContractors');
                var curChannelNum=numContractors+1;
                for(i=0;i<numGailNodes;i++)
                {
                    var str='channelg'+i.toString()+'c'+curChannelNum.toString();
                    console.log(str);
                    const networkChannel = await gateway.getNetwork(str);
                    const contractChannel = networkChannel.getContract('contractors');
                    await contractChannel.submitTransaction('createUser',req.body.username, req.body.password);
                }

                await contract.submitTransaction('updateNumContractors');
                // Disconnect from the gateway.
                await gateway.disconnect();
                await gatewayGail.disconnect();
                dict.set(req.body.username,curChannelNum.toString());

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.json({
                    success: true,
                    username: req.body.username
                });
            }
        }
    }
});

module.exports = router;
