import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { id } from '../id.js';
import { Note } from './note.js';
import { Channel } from './channel.js';

@Entity()
@Index(['channelId', 'noteId'], { unique: true })
export class ChannelNotePining {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the ChannelNotePining.',
	})
	public createdAt: Date;

	@Index()
	@Column(id())
	public channelId: Channel['id'];

	@ManyToOne(() => Channel, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public channel: Channel | null;

	@Column(id())
	public noteId: Note['id'];

	@ManyToOne(() => Note, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public note: Note | null;
}
