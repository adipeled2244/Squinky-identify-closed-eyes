let urlUpload;
let apigClient, apigateway, accessKeyId, sessionToken, secretAccessKey, expireTime,identityId;


async function awsInit() {
  const region = 'eu-west-1';
  AWS.config.region = region;
  AWS.config.credentials = await new AWS.CognitoIdentityCredentials({ IdentityPoolId: 'eu-west-1:c15c4641-2331-4b54-892e-9538b784d407' });
  await AWS.config.credentials.get(function (err) {
    
    apigClient = apigClientFactory.newClient({
      accessKey: AWS.config.credentials.accessKeyId,
      secretKey: AWS.config.credentials.secretAccessKey,
      sessionToken: AWS.config.credentials.sessionToken,
      region: region,
    });

    // kinesis -- START
    identityId=AWS.config.credentials.identityId;
    let kinesis = new AWS.Kinesis();
    let  params = {
      Data: JSON.stringify({
        "msg": "test err",
        time: new Date()
      }),
      PartitionKey:'partition-' + identityId, /* required */
      StreamName: 'cloudfront-logs', /* required */
  
    };
    kinesis.putRecord(params, function(err, data) {
      // if (err) console.log(err, err.stack); // an error occurred
      // else     console.log(data);           // successful response
    });
    // kinesis -- END

    if (err) console.error(err);
  });
  
}


async function ekUpload() {
  async function Init() {
    await awsInit()
    var fileSelect = document.getElementById("file-upload"),
      fileDrag = document.getElementById("file-drag"),
      submitButton = document.getElementById("submit-button");

    fileSelect.addEventListener("change", fileSelectHandler, false);

    // Is XHR2 available?
    var xhr = new XMLHttpRequest();
    if (xhr.upload) {
      // File Drop
      fileDrag.addEventListener("dragover", fileDragHover, false);
      fileDrag.addEventListener("dragleave", fileDragHover, false);
      fileDrag.addEventListener("drop", fileSelectHandler, false);
    }
  }
 
  function fileDragHover(e) {
    var fileDrag = document.getElementById("file-drag");

    e.stopPropagation();
    e.preventDefault();

    fileDrag.className =
      e.type === "dragover" ? "hover" : "modal-body file-upload";
  }

  function fileSelectHandler(e) {
    // Fetch FileList object
    var files = e.target.files || e.dataTransfer.files;

    // Cancel event and hover styling
    fileDragHover(e);

    // Process all File objects
    for (var i = 0, f;
      (f = files[i]); i++) {
      parseFile(f);
      uploadFile(f);
    }
  }

  // Output
  function output(msg) {
    // Response
    var m = document.getElementById("messages");
    m.innerHTML = msg;
  }

  function parseFile(file) {
    output("<strong>" + encodeURI(file.name) + "</strong>");
    var imageName = file.name;

    var isGood = /\.(?=gif|jpg|png|jpeg)/gi.test(imageName);
    if (isGood) {
      document.getElementById("start").classList.add("hidden");
      document.getElementById("response").classList.remove("hidden");
      document.getElementById("notimage").classList.add("hidden");
      // Thumbnail Preview
      document.getElementById("file-image").classList.remove("hidden");
      document.getElementById("file-image").src = URL.createObjectURL(file);
    } else {
      document.getElementById("file-image").classList.add("hidden");
      document.getElementById("notimage").classList.remove("hidden");
      document.getElementById("start").classList.remove("hidden");
      document.getElementById("response").classList.add("hidden");
      document.getElementById("file-upload-form").reset();
    }
  }

  // const getNumbersEyesClose = (value, confidense) => {
  //   if (value == true && confidense > 85) return 0;
  //   if (value == true && confidense > 50) return 1;
  //   if (value == true && confidense > 0) return 2;
  //   if (value == false && confidense > 85) return 2;
  //   if (value == false && confidense > 50) return 1;
  //   if (value == false && confidense > 0) return 0;

  // }

  const calculateEye = (xRight, xLeft, yTop, yBottom) => {
    return { x: ((xRight + xLeft) / 2), y: ((yTop + yBottom) / 2) };
  }

  function callPresignedUrl(filename) {
    return apigClient.presignedUrlPost({}, { filename }, {});

  }

  async function uploadToS3(file, presignedURL) {
    await fetch(presignedURL, {
      method: "PUT",
      body: file
    });
  }

  function callProccessImg(filename) {
    return apigClient.processImgPost({}, { filename }, {});
  }

  async function uploadFile(file) {
    var xhr = new XMLHttpRequest(),
      fileInput = document.getElementById("class-roster-file"),
      pBar = document.getElementById("file-progress"),
      fileSizeLimit = 1024; // In MB
    if (xhr.upload) {
      // Check if file is less than x MB
      if (file.size <= fileSizeLimit * 1024 * 1024) {
        // Progress bar
        pBar.style.display = "inline";

        let presignedURL = '';
        let imgName = '';
        // step 1 -Make a POST request - to get pre url
        try {
          const getPreUrlS3 = await callPresignedUrl(file.name);
          if (getPreUrlS3.status != 200)
            throw getPreUrlS3;

          let body = JSON.parse(getPreUrlS3.data.body);
          imgName = body.filename;
          presignedURL = body.presigned_url;

          // step 2 - upload image to S3
          await uploadToS3(file, presignedURL);

          // step 3 - send to proccess img lambda - rekognition
          const proccessedResponse = await callProccessImg(imgName);

          const proccessedBody = proccessedResponse.data[0];
          
          const peopleInformation = document.getElementsByClassName('people-information')[0];

          const resultImg = document.getElementById("result-img");
          const proccessedResult = document.getElementById("proccessed-result");
          const fileUploadForm = document.getElementById('file-upload-form');
          fileUploadForm.style.display = "none";
          proccessedResult.style.display = "block";
          if (proccessedBody.imgUrl)
            resultImg.src = proccessedBody.imgUrl;
          else {
            resultImg.style.display = "none";
            throw "imgUrl undefined"
          }


          if (!proccessedBody.FaceDetails || proccessedBody.FaceDetails && !proccessedBody.FaceDetails.length) {
            peopleInformation.innerHTML = `<div class="label-form-result"><b>No Faces were detected! :(</b></div>`;
            return;
          }
          let couterOfClosesEyePeople = 0;
          const personsArray = proccessedBody.FaceDetails?.map((person, index) => {
            const { Landmarks, eyeCount } = person;
            const leftEye = calculateEye(Landmarks[11].X, Landmarks[12].X, Landmarks[13].Y, Landmarks[14].Y);
            const rightEye = calculateEye(Landmarks[15].X, Landmarks[16].X, Landmarks[17].Y, Landmarks[18].Y);
            const closedEyes = eyeCount;
            if(eyeCount){couterOfClosesEyePeople++}

            return `${ closedEyes ? `<div class="label-form-result top-label"><b>Person ${couterOfClosesEyePeople}</b> </div>
              <div class="label-form-result"><b>Closes Eyes:</b> <span class="label-fill">${closedEyes}</span> </div><br/> 
              <div class="label-form-result"><b>Cordinates LeftEye:</b><span class="label-fill">${` X:` + leftEye.x.toFixed(4)}</span>  </div>
              <div class="label-form-result"><b class="white-font">Cordinates LeftEye:</b><span class="label-fill">${` Y:` + leftEye.y.toFixed(4)}</span>  </div><br/>
              <div class="label-form-result"><b>Cordinates RightEye:</b><span class="label-fill">${` X:` + rightEye.x.toFixed(4)}</span>  </div>
              <div class="label-form-result"><b class="white-font">Cordinates RightEye:</b><span class="label-fill">${` Y:` + rightEye.y.toFixed(4)}</span>  </div><br/>` :``
              }`
              
          });
          personsArray?.unshift(`<div class="label-form-result"><b>Faces with closed eyes: </b> <span class="label-fill">${proccessedBody.faceCount}</span> </div>`);
          personsArray?.unshift(`<div class="label-form-result"><b>Closed eyes: </b> <span class="label-fill">${proccessedBody.eyeCount ?? 0}</span> </div>`);
          peopleInformation.innerHTML = personsArray?.join(' ');
        } catch (e) {
          console.error(e);
          const errorDiv = document.getElementById("error-div");
          const errorMessage = document.getElementById("error-message");
          errorMessage.innerText = "Something has went wrong v_v";
          errorDiv.style.display = "block";
        }

      } else {
        output("Please upload a smaller file (< " + fileSizeLimit + " MB).");
      }
    }
  }

  // Check for the various File API support.
  if (window.File && window.FileList && window.FileReader) {
  
    await Init();
  } else {
    document.getElementById("file-drag").style.display = "none";
  }
}
ekUpload();