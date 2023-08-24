// variable "profile" {
//   type    = string
//   default = "dev-packer"
// }

variable "aws_region" {
  type    = string
  default = env("AWS_DEFAULT_REGION")
}

variable "source_ami" {
  type    = string
  default = env("SOURCE_AMI") # Amazon Linux 2 AMI (HVM) - Kernel 5.10
}

variable "ssh_username" {
  type    = string
  default = env("SSH_USERNAME")
}

// variable "subnet_id" {
//   type    = string
//   default = env("DEFAULT_SUBNET_ID")
// }

# https://www.packer.io/plugins/builders/amazon/ebs
source "amazon-ebs" "my-ami" {
  // profile         = "${var.profile}"
  region          = "${var.aws_region}"
  ami_users       = ["760210918160", "234881932566"]
  ami_name        = "csye6225_${formatdate("YYYY_MM_DD_hh_mm_ss", timestamp())}"
  ami_description = "AMI for CSYE 6225"
  // ami_regions = [
  //   "us-east-1",
  // ]

  aws_polling {
    delay_seconds = 120
    max_attempts  = 50
  }


  instance_type = "t2.micro"
  source_ami    = "${var.source_ami}"
  ssh_username  = "${var.ssh_username}"
  // subnet_id     = "${var.subnet_id}"

  launch_block_device_mappings {
    delete_on_termination = true
    device_name           = "/dev/xvda"
    volume_size           = 8
    volume_type           = "gp2"
  }
}

build {
  sources = ["source.amazon-ebs.my-ami"]

  provisioner "file" {
    source      = "webapp.zip"
    destination = "webapp.zip"
  }

  provisioner "shell" {
    script = "packer/script.sh"
  }
}
