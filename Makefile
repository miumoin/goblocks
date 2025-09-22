deploy: 
	cp .env.prod .env
	cd view && npm run build
	GOOS=linux GOARCH=amd64 go build -tags lambda.norpc -o app main.go
	ssh -i ~/.ssh/wit.works.pem ubuntu@ec2-52-10-14-40.us-west-2.compute.amazonaws.com "unlink /var/www/apps/app005.typewriting.ai/app"
	ssh -i ~/.ssh/wit.works.pem ubuntu@ec2-52-10-14-40.us-west-2.compute.amazonaws.com "rm -rf /var/www/apps/app005.typewriting.ai/view"
	scp -i ~/.ssh/wit.works.pem app ubuntu@ec2-52-10-14-40.us-west-2.compute.amazonaws.com:/var/www/apps/app005.typewriting.ai 
	scp -i ~/.ssh/wit.works.pem .env ubuntu@ec2-52-10-14-40.us-west-2.compute.amazonaws.com:/var/www/apps/app005.typewriting.ai
	ssh -i ~/.ssh/wit.works.pem ubuntu@ec2-52-10-14-40.us-west-2.compute.amazonaws.com "mkdir -p /var/www/apps/app005.typewriting.ai/view"
	scp -i ~/.ssh/wit.works.pem -r ./view/dist ubuntu@ec2-52-10-14-40.us-west-2.compute.amazonaws.com:/var/www/apps/app005.typewriting.ai/view/
	ssh -i ~/.ssh/wit.works.pem ubuntu@ec2-52-10-14-40.us-west-2.compute.amazonaws.com "cd /var/www/apps/app005.typewriting.ai && sudo pkill -9 -f './app' && nohup ./app > app.log 2>&1 &"
	cp .env.dev .env