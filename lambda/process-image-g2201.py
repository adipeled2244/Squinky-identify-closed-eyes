import boto3
from decimal import Decimal
import json
import urllib.request
import urllib.parse
import urllib.error
import io 
from PIL import Image, ImageDraw, ExifTags, ImageColor
print('Loading function')

rekognition = boto3.client('rekognition')
s3client = boto3.client('s3', region_name='us-west-2')


# --------------- Helper Functions to call Rekognition APIs ------------------


def detect_faces(bucket, key):
    response = rekognition.detect_faces(Image={"S3Object": {"Bucket": bucket, "Name": key}},Attributes=['ALL'])
    return response


def detect_labels(bucket, key):
    response = rekognition.detect_labels(Image={"S3Object": {"Bucket": bucket, "Name": key}})

    return response


def index_faces(bucket, key):
    # Note: Collection has to be created upfront. Use CreateCollection API to create a collecion.
    #rekognition.create_collection(CollectionId='BLUEPRINT_COLLECTION')
    response = rekognition.index_faces(Image={"S3Object": {"Bucket": bucket, "Name": key}}, CollectionId="BLUEPRINT_COLLECTION")
    return response
#---------------------------------------marks eyes------------------------------------------------------------#



def show_faces(photo,bucket):
     

    client=boto3.client('rekognition')

    # Load image from S3 bucket
    s3_connection = boto3.resource('s3')
    s3_object = s3_connection.Object(bucket,photo)
    s3_response = s3_object.get()

    stream = io.BytesIO(s3_response['Body'].read())
    image=Image.open(stream)
    
    format = image.format

    # TODO - detect transpose
    
    # # fix image orientation
    exif = image._getexif()
    if exif:
        for orientation in ExifTags.TAGS.keys():
            if ExifTags.TAGS[orientation]=='Orientation':
                break

        if exif[orientation] == 3:
            image=image.rotate(180, expand=True)
        elif exif[orientation] == 6:
            image=image.rotate(270, expand=True)
        elif exif[orientation] == 8:
            image=image.rotate(90, expand=True)
    

        
    #Call DetectFaces 
    response = client.detect_faces(Image={'S3Object': {'Bucket': bucket, 'Name': photo}},
        Attributes=['ALL'])
    print('rekognition response: ',response)
  
    draw = ImageDraw.Draw(image)  
    
    face_counter = 0 
    eye_counter = 0
    # calculate and display bounding boxes for each detected face       
    print('Detected faces for ' + photo)    
    for faceDetail in response['FaceDetails'] :
        faceDetail['eyeCount'] = 0
        if faceDetail['EyesOpen']['Value'] == True and faceDetail['EyesOpen']['Confidence'] > 65:
            continue
        
        face_counter += 1
        eye_counter += 1
        faceDetail['eyeCount'] +=1
        if((faceDetail['EyesOpen']['Value'] == True and faceDetail['EyesOpen']['Confidence'] < 65) or (faceDetail['EyesOpen']['Value'] == False and faceDetail['EyesOpen']['Confidence'] > 85)):
            eye_counter += 1
            faceDetail['eyeCount'] +=1
            
        imgWidth, imgHeight = image.size  
        box = faceDetail['BoundingBox']
        left = imgWidth * box['Left']
        top = imgHeight * box['Top']
        width = imgWidth * box['Width']
        height = imgHeight * box['Height']
        
        print('Left: ' + '{0:.0f}'.format(left))
        print('Top: ' + '{0:.0f}'.format(top))
        print('Face Width: ' + "{0:.0f}".format(width))
        print('Face Height: ' + "{0:.0f}".format(height))

        points = (
            (left,top),
            (left + width, top),
            (left + width, top + height),
            (left , top + height),
            (left, top)
        )

        draw.line(points, fill='#00d400', width=4)

        # Alternatively can draw rectangle. However you can't set line width.
        # draw.rectangle([left,top, left + width, top + height], outline='#00d400') 

    response['faceCount'] = face_counter
    response['eyeCount'] = eye_counter
    # image.show()
    # Save the image to an in-memory file
    in_mem_file = io.BytesIO()
    image.save(in_mem_file, format=format)
    in_mem_file.seek(0)
    
    # Upload image to s3
    s3client.upload_fileobj(
        in_mem_file, # This is what i am trying to upload
        's3-savedimages-g2201',
        photo
    )
    s3client.delete_object(Bucket=bucket, Key=photo)

    response['imgUrl'] = 'https://s3-savedimages-g2201.s3.eu-west-1.amazonaws.com/' + photo;
    
    return response


# --------------- Main handler ------------------


def lambda_handler(event, context):
    '''Demonstrates S3 trigger that uses
    Rekognition APIs to detect faces, labels and index faces in S3 Object.
    '''
    #print("Received event: " + json.dumps(event, indent=2))

    # Get the object from the event
    bucket = "s3-preprocessed-images-g2201"
    key = urllib.parse.unquote_plus(event['filename'])
    try:
        # # Calls rekognition DetectFaces API to detect faces in S3 object
        # response = detect_faces(bucket, key)
        # print(response)


        response = show_faces(key,bucket)
        print("response: ", response)
        # return response, status
        return response ,200

    except Exception as e:
        print(e)
        print("Error processing object {} from bucket {}. ".format(key, bucket) +
              "Make sure your object and bucket exist and your bucket is in the same region as this function.")
        return {'msg':'Error'},400
        raise e
