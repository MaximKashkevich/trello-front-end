import axios, { type CreateAxiosDefaults } from 'axios'

import { errorCatch } from './error'
import {
	getAccessToken,
	removeFromStorage
} from '@/services/auth-token.service'
import { authService } from '@/services/auth.service'

const options: CreateAxiosDefaults = {
	baseURL: 'http://localhost:4200/api', //Вынести в .env
	headers: {
		'Content-Type': 'application.json' // работа с json
	},
	withCredentials: true //Свойство для того чтобы работали серверные cookie
}

const axiosClassic = axios.create(options) // Для базовых запросов

const axiosWithAuth = axios.create(options) // Для запросов с авторизацией

axiosWithAuth.interceptors.request.use(config => {
	const accessToken = getAccessToken() // Получаем токен из куки
	if (config?.headers && accessToken)
		config.headers.Authorization = `Bearer ${accessToken}` // Добавляем токен в заголовок
	return config
})

axiosWithAuth.interceptors.response.use(
	config => config, // Если ответ успешный, просто возвращаем его
	async error => {
		const originalRequest = error.config
		if (
			(error?.response?.status === 401 || // Ошибка 401 (Unauthorized)
				errorCatch(error) === 'jwt expired' || // Токен истек
				errorCatch(error) === 'jwt must be provided') && // Токен отсутствует
			error.config &&
			!error.config._isRetry // Проверяем, что запрос не был повторен
		) {
			originalRequest._isRetry = true // Помечаем запрос как повторный
			try {
				await authService.getNewTokens() // Пытаемся обновить токен
				return axiosWithAuth.request(originalRequest) // Повторяем запрос
			} catch (error) {
				if (errorCatch(error) === 'jwt expired') removeFromStorage() // Удаляем токен, если он истек
			}
		}
		throw error // Если ошибка не связана с токеном, выбрасываем ее
	}
)

export { axiosClassic, axiosWithAuth }
