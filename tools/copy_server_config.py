#!/usr/bin/python
# -*- coding: UTF-8 -*-

#拷贝策划配置

import os

import utils

def copy_config():
	config = utils.get_json_file_data('config.json')

	planConfigRootPath = utils.format_path(os.path.join(os.getcwd(), config['planConfigDir']))
	serverSrcPath = utils.format_path(os.path.join(planConfigRootPath, config['serverOnlyDirName']))
	commonSrcPath = utils.format_path(os.path.join(planConfigRootPath, config['commonDirName']))
	activitiesSrcPath = utils.format_path(os.path.join(planConfigRootPath, config['activitiesDirName']))

	dstPath = utils.format_path(os.path.join(os.getcwd(), config['serverConfigDir']))

	filterList = []
	for filterFile in config['serverNotCopy']:
		filterPath = utils.format_path(os.path.join(planConfigRootPath, filterFile))
		filterList.append(filterPath)

	utils.logger_info("更新配置......")
	os.system("svn update " + (planConfigRootPath).encode('gbk'))
	utils.logger_info("配置更新完成，准备拷贝！")
	
	utils.logger("配置源目录：")
	utils.logger(serverSrcPath.encode('utf-8'))
	utils.logger(commonSrcPath.encode('utf-8'))
	utils.logger(activitiesSrcPath.encode('utf-8'))
	utils.logger("拷贝到：" + dstPath.encode('utf-8'))
	utils.cover_copy_files(commonSrcPath, dstPath, filterList)
	utils.cover_copy_files(serverSrcPath, dstPath, filterList)
	utils.cover_copy_files(activitiesSrcPath, dstPath, filterList)
	utils.logger_info('配置拷贝结束！')

if __name__ == '__main__':
	copy_config()
	raw_input(unicode('\n按任意键退出...','utf-8').encode('gbk'))

