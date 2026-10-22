self.setProjectionHandler(definition=>{if(definition!=='saltmarcher-plane-v1')throw Error('Unknown projection');return{forward:([x,y])=>[x*250000,y*250000],inverse:([x,y])=>[x/250000,y/250000]};});
