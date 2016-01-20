/* global Reach */

import history from '../history';
import { getRoom, deleteRoom, getNamespaceRef } from '../utils/com';
import {reset} from 'redux-form';

export const ROOM_ENTER = 'ROOM_ENTER';
export const ROOM_LEFT = 'ROOM_LEFT';
export const STREAM_RECEIVED = 'STREAM_RECEIVED';
export const STREAM_SUBSCRIBED = 'STREAM_SUBSCRIBED';
export const STREAM_UNSUBSCRIBED = 'STREAM_UNSUBSCRIBED';
export const STREAM_PUBLISHED = 'STREAM_PUBLISHED';
export const STREAM_UNPUBLISHED = 'STREAM_UNPUBLISHED';
export const VIDEO_MUTED = 'VIDEO_MUTED';
export const VIDEO_UNMUTED = 'VIDEO_UNMUTED';
export const AUDIO_MUTED = 'AUDIO_MUTED';
export const AUDIO_UNMUTED = 'AUDIO_UNMUTED';
export const PARTICIPANT_JOIN = 'PARTICIPANT_JOIN';
export const PARTICIPANT_LEFT = 'PARTICIPANT_LEFT';
export const VIDEO_FOCUS = 'VIDEO_FOCUS';
export const TOGGLE_CHAT = 'TOGGLE_CHAT';
export const MESSAGE_RECEIVED = 'MESSAGE_RECEIVED';
export const MESSAGE_SENT = 'MESSAGE_SENT';


export function subscribeStream(username, roomname, streamData, videoTab) {
	return (dispatch, getState) => {
		const streamId = Object.keys(streamData)[0];
		const room = getRoom(username, roomname);

		const user = getState().room.users.find(u => u.streamId === streamId);
		if (user.subscribed) {
			return;
		}


		room.subscribeToStream(streamData, videoTab);
		dispatch({
			type: STREAM_SUBSCRIBED,
			data: {
				username: streamData[streamId].from,
				streamId
			}
		});
	};
}

export function listenToStreams(username, roomname) {
	return (dispatch, getState) => {
		const room = getRoom(username, roomname);

		room.on('publishedStream', (data) => {
			const streamId = Object.keys(data)[0];
			const _from = data[streamId].from;

			if (_from === username) {
				return;
			}

			dispatch({
				type: STREAM_RECEIVED,
				data: {
					username: _from,
					streamId,
					streamData : { ...data }
				}
			});
		});

		room.on('unPublishedStream', (streamId) => {
			const user = getState().room.users.find(u => u.streamId === streamId);

			if (user.subscribed) {
				room.unSubscribeFromStream(streamId);
			}

			dispatch({
				type: STREAM_UNPUBLISHED,
				data: streamId
			});

			dispatch({
				type: STREAM_UNSUBSCRIBED,
				data: streamId
			});
		});
	};
}

export function listenToJoinAndLeave(username, roomname) {
	return dispatch => {
		const room = getRoom(username, roomname);

		room.on('participantJoin', userId => {
			dispatch({
				type: PARTICIPANT_JOIN,
				data: userId
			});
		});

		room.on('participantLeave', userId => {
			dispatch({
				type: PARTICIPANT_LEFT,
				data: userId
			});
		});
	};
}

export function sendMessage(username, roomname, message) {
	return dispatch => {
		const room = getRoom(username, roomname);

		room.sendInstantMessage(message);
		dispatch(reset('chat'));

		dispatch({
			type: MESSAGE_SENT,
			data: message
		});
	}
}

export function listenMessages(username, roomname) {
	return dispatch => {
		const room = getRoom(username, roomname);

		room.on('instantMessage', data => {
			dispatch({
				type: MESSAGE_RECEIVED,
				data: {
					username: data.from,
					message: data.message,
					ts: data.timestamp
				}
			});
		});
	};
}

export function enterRoom(roomname, owner, username) {
	return dispatch => {
		dispatch({
			type: ROOM_ENTER,
			data: {
				name: roomname,
				owner
			}
		});

		let ref = getNamespaceRef().child(`reach/userList/${username}`);

		ref.update({
			room: roomname
		});
		ref.child('room').onDisconnect().remove();

		dispatch(listenMessages(username, roomname));

		dispatch(listenToJoinAndLeave(username, roomname));

		history.push('/visio');
	};
}

export function publishStream(username, roomname, videoTag) {
	return dispatch => {
		const room = getRoom(username, roomname);
		const streamId = `${username}-stream`;

		room.publishStream(streamId,
			videoTag,
			Reach.actions.ACTION_TYPE_AUDIO_VIDEO,
			(mediaStream) => {
				dispatch({
					type: STREAM_PUBLISHED,
					data: {
						streamId,
						username
					}
				});
			}
		);
	};
}

export function quitRoom(username, roomObj) {
	return dispatch => {
		const {
			name: roomname,
			users,
			localStreamId
		} = roomObj;

		const room = getRoom(username, roomname);

		(users || []).forEach((u) => {
			if (u.streamData) {
				room.unSubscribeFromStream(u.streamId);
				dispatch({
					type: STREAM_UNSUBSCRIBED,
					data: u.streamId
				});
			}
			else if (u.streamId) {
				room.unPublishStream(u.streamId);
			}
		});


		history.push('/participants');

		room.close(false);
		deleteRoom(roomname);

		getNamespaceRef().child(`reach/userList/${username}/room`).remove();

		dispatch({
			type: ROOM_LEFT,
			data: {...roomObj }
		});
	};
}

export function toggleAudio(username, roomObj) {
	const {
		name: roomname,
		localAudioMuted: muted
	} = roomObj;

	const { streamId } = roomObj.users.find(u => u.name === username);

	const room = getRoom(username, roomname);

	if (muted) {
		room.unmuteAudioStream(streamId);
	} else {
		room.muteAudioStream(streamId);
	}

	return {
		type: muted ?  AUDIO_UNMUTED : AUDIO_MUTED,
		data: streamId
	};
}

export function toggleVideo(username, roomObj) {
	const {
		name: roomname,
		localVideoMuted: muted
		//localStreamId: streamId
		} = roomObj;

	const { streamId } = roomObj.users.find(u => u.name === username);

	const room = getRoom(username, roomname);

	if (muted) {
		room.unmuteVideoStream(streamId);
	} else {
		room.muteVideoStream(streamId);
	}

	return {
		type: muted ? VIDEO_UNMUTED : VIDEO_MUTED,
		data: streamId
	};
}

export function focusVideo(ref) {
	return {
		type: VIDEO_FOCUS,
		data: ref
	};
}

export function toggleChat() {
	return {
		type: TOGGLE_CHAT
	};
}