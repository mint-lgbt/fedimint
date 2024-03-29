import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { id } from '../id.js';
import { Note } from './note.js';
import { User } from './user.js';

@Entity()
@Index(['userId', 'noteId'], { unique: true })
export class NoteFavorite {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the NoteFavorite.',
	})
	public createdAt: Date;

	@Index()
	@Column(id())
	public userId: User['id'];

	@ManyToOne(() => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Column(id())
	public noteId: Note['id'];

	@ManyToOne(() => Note, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public note: Note | null;
}
