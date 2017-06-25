// This is an extension for development and testing of the Scratch Javascript Extension API.

(function(ext) {
    var UART_REV_FRAME_LEN=484;
    var device = null;

    var	FrameStep=0;
    var FrameBuf= new Uint8Array(800);
    var DataBuf= new Uint8Array(800);
    var	WhenDataOKReq=0;
	
	
	
    function GetFrame(ch) {
	 //AA 95 4F FE FE FE BF 47 16
	 console.log('FrameStep' + FrameStep);
	 console.log('ch' + ch);
	 if(FrameStep>800)
		FrameStep=0; 
	//等待接收帧头    
    	if(FrameStep==0){
		if(ch==0xaa){
			FrameStep=1;
			FrameBuf[0]=ch;
		}
	}
   	else if((FrameStep>=1)&&(FrameStep<(UART_REV_FRAME_LEN+1))){
		FrameBuf[FrameStep]=ch;
		FrameStep++;
	}
  	else if(FrameStep==(UART_REV_FRAME_LEN+1)) 
  	{
      		if(ch==0x16){
			clearTimeout(watchdog); 
        		watchdog = null;
			for(var j=0;j<UART_REV_FRAME_LEN;j++){
				DataBuf[j]=FrameBuf[j];
			}
			WhenDataOKReq=1;
      		}		
      		else
      		{
        		console.log('结束符错误'+ch);
        		FrameStep=0;
      		}
  	}
 	else
  	{
   	 	FrameStep=0;
  	}
}

    // Extension API interactions
    var potentialDevices = [];
    ext._deviceConnected = function(dev) {
        potentialDevices.push(dev);
        if (!device) {
            tryNextDevice();
        }
    }

    var watchdog = null;
    function tryNextDevice() {
        // If potentialDevices is empty, device will be undefined.
        // That will get us back here next time a device is connected.
        device = potentialDevices.shift();
        if (!device) return;

        device.open({ stopBits: 0, bitRate: 115200, parityBit:0, ctsFlowControl: 0 });
        device.set_receive_handler(function(data) {
	    var rawData = new Uint8Array(data);	
	    console.log('Received size' + data.byteLength);	
            //放置接收的数据到环形缓冲区
            for(var i=0;i<data.byteLength;i++)
            {
		GetFrame(rawData[i]);  
            }
        });

        watchdog = setTimeout(function() {
            device.set_receive_handler(null);
            device.close();
            device = null;
            tryNextDevice();
        }, 5000);
    };
	
    ext.resetAll = function(){};	

    ext._deviceRemoved = function(dev) {
        if(device != dev) return;
        device = null;
    };

    ext._shutdown = function() {
        if(device) device.close();
        device = null;
    };

    ext._getStatus = function() {
        if(!device) return {status: 1, msg: 'ScratchMiniBoard disconnected'};
        if(watchdog) return {status: 1, msg: 'Probing for ScratchMiniBoard'};
        return {status: 2, msg: 'ScratchMiniBoard connected'};
    }
    
    ext.WhenPicDataOK = function() {
	    
        if (WhenDataOKReq >0) {
		WhenDataOKReq=0;
		return true;
	}
        else{
		return false;
	}
    };

    ext.PicData = function(x,y) {
	return DataBuf[x*22+y];
    }
/******************************************************/
    var descriptor = {
        blocks: [
            ['r', 'X %n Y %n 灰度值', 'PicData', '2', '0'],
            ['h', '当接收到图像数据', 'WhenPicDataOK']
        ],
        menus: {
        },
        url: 'https://abbottchen.github.io/test/ScratchMiniBoard.js'
    };
    ScratchExtensions.register('Scratch ADNS', descriptor, ext, {type: 'serial'});
})({});
